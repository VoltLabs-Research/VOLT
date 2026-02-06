import { injectable, inject } from 'tsyringe';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { IJobRepository } from '@modules/jobs/domain/ports/IJobRepository';

interface BaseJob {
    jobId: string;
    status: string;
    teamId: string;
    queueType: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    timestamp?: string;
    progress?: number;
    name?: string;
    message?: string;
    sessionId?: string;
    error?: string;
    [key: string]: any;
}

interface FrameJobGroup {
    timestep: number;
    jobs: BaseJob[];
    overallStatus: 'running' | 'completed' | 'failed' | 'partial';
}

interface TrajectoryJobGroup {
    trajectoryId: string;
    trajectoryName?: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: 'running' | 'completed' | 'failed' | 'partial';
    completedCount: number;
    totalCount: number;
}

@injectable()
export default class TrajectoryJobsService {
    private readonly queueConfigs = [
        { name: 'trajectory_processing', statusPrefix: 'trajectory_processing_queue:status:' },
        { name: 'rasterizer', statusPrefix: 'rasterizer_queue:status:' },
        { name: 'analysis', statusPrefix: 'analysis_queue:status:' },
        { name: 'ssh-import', statusPrefix: 'ssh_import_queue:status:' },
        { name: 'cloud-upload', statusPrefix: 'cloud_upload_queue:status:' }
    ];

    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository
    ){}

    async getGroupedJobsForTeam(teamId: string): Promise<TrajectoryJobGroup[]> {
        if (!teamId) return [];

        const jobIds = await this.jobRepository.getTeamJobIds(teamId);
        if (!jobIds || jobIds.length === 0) return [];

        const allJobs: BaseJob[] = [];

        // Fetch job statuses from all queues
        for (const config of this.queueConfigs) {
            const statusKeys = jobIds.map(id => `${config.statusPrefix}${id}`);
            const batchSize = 500;

            for (let i = 0; i < statusKeys.length; i += batchSize) {
                const batchKeys = statusKeys.slice(i, i + batchSize);
                const pipeline = this.jobRepository.pipeline();
                batchKeys.forEach(k => pipeline.get(k));

                const results = await pipeline.exec();
                if (!results) continue;

                for (const [err, value] of results) {
                    if (err || !value) continue;
                    try {
                        const data = JSON.parse(value as string);
                        if (data.teamId !== teamId) continue;
                        allJobs.push({ ...data, queueType: config.name });
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }

        // Deduplicate by job ID, keeping the latest
        const jobMap = new Map<string, BaseJob>();
        for (const job of allJobs) {
            const prev = jobMap.get(job.jobId);
            const tNew = job.timestamp ? new Date(job.timestamp).getTime() : 0;
            const tPrev = prev?.timestamp ? new Date(prev.timestamp).getTime() : 0;
            if (!prev || tNew > tPrev) jobMap.set(job.jobId, job);
        }

        const uniqueJobs = Array.from(jobMap.values());
        return this.groupJobsByTrajectory(uniqueJobs);
    }

    normalizeUpdate(jobData: any): any {
        return {
            jobId: jobData.jobId,
            status: jobData.status,
            progress: jobData.progress || 0,
            name: jobData.name,
            message: jobData.message,
            trajectoryId: jobData.trajectoryId || jobData.metadata?.trajectoryId,
            trajectoryName: jobData.trajectoryName || jobData.metadata?.trajectoryName,
            timestep: jobData.timestep || jobData.metadata?.timestep,
            sessionId: jobData.sessionId || jobData.metadata?.sessionId,
            sessionStartTime: jobData.sessionStartTime || jobData.metadata?.sessionStartTime,
            timestamp: jobData.timestamp || new Date().toISOString(),
            queueType: jobData.queueType || 'unknown',
            type: jobData.type,
            ...(jobData.error && { error: jobData.error }),
            ...(jobData.result && { result: jobData.result }),
            ...(jobData.processingTimeMs && { processingTimeMs: jobData.processingTimeMs })
        };
    }

    private computeStatus(jobs: BaseJob[]): 'running' | 'completed' | 'failed' | 'partial' {
        const hasRunning = jobs.some(j => j.status === 'running' || j.status === 'queued');
        const hasFailed = jobs.some(j => j.status === 'failed');
        const allCompleted = jobs.every(j => j.status === 'completed');
        if (hasRunning) return 'running';
        if (allCompleted) return 'completed';
        if (hasFailed && jobs.filter(j => j.status === 'completed').length === 0) return 'failed';
        return 'partial';
    }

    private groupJobsByFrame(jobs: BaseJob[]): FrameJobGroup[] {
        const frameMap = new Map<number, BaseJob[]>();
        for (const job of jobs) {
            const key = job.timestep ?? 0;
            if (!frameMap.has(key)) frameMap.set(key, []);
            frameMap.get(key)!.push(job);
        }

        const result: FrameJobGroup[] = [];
        for (const [timestep, frameJobs] of frameMap) {
            const sorted = this.sortByTimestamp(frameJobs);
            result.push({ timestep, jobs: sorted, overallStatus: this.computeStatus(frameJobs) });
        }

        return result.sort((a, b) => b.timestep - a.timestep);
    }

    private groupJobsByTrajectory(jobs: BaseJob[]): TrajectoryJobGroup[] {
        const trajMap = new Map<string, BaseJob[]>();
        for (const job of jobs) {
            const trajId = job.trajectoryId || 'unknown';
            if (!trajMap.has(trajId)) trajMap.set(trajId, []);
            trajMap.get(trajId)!.push(job);
        }

        const result: TrajectoryJobGroup[] = [];
        for (const [trajectoryId, trajJobs] of trajMap) {
            const sorted = this.sortByTimestamp(trajJobs);
            const completedCount = sorted.filter(j => j.status === 'completed').length;
            const trajectoryName = sorted[0].trajectoryName;
            const latestTimestamp = sorted[0]?.timestamp || new Date().toISOString();

            result.push({
                trajectoryId,
                trajectoryName,
                frameGroups: this.groupJobsByFrame(sorted),
                latestTimestamp,
                overallStatus: this.computeStatus(sorted),
                completedCount,
                totalCount: sorted.length
            });
        }

        return result.sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());
    }

    private sortByTimestamp(jobs: BaseJob[]): BaseJob[] {
        return [...jobs].sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tb - ta;
        });
    }
}
