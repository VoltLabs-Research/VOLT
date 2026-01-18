import { inject, injectable } from 'tsyringe';
import { IJobRepository } from '@modules/jobs/domain/ports/IJobRepository';
import { IQueueRegistry } from '@modules/jobs/domain/ports/IQueueRegistry';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import logger from '@shared/infrastructure/logger';

interface TrajectoryJobGroup {
    trajectoryId: string;
    trajectoryName: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: string;
    completedCount: number;
    totalCount: number;
}

interface FrameJobGroup {
    timestep: number;
    jobs: any[];
    overallStatus: string;
}

@injectable()
export default class TeamJobsService {
    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository,

        @inject(JOBS_TOKENS.QueueRegistry)
        private readonly queueRegistry: IQueueRegistry
    ){}

    async getTeamJobs(teamId: string): Promise<TrajectoryJobGroup[]> {
        try {
            const jobIds = await this.jobRepository.getTeamJobIds(teamId);

            if (!jobIds || jobIds.length === 0) {
                return [];
            }

            // Dynamically get all registered queue status key prefixes
            const queuePrefixes = this.queueRegistry.getAllStatusKeyPrefixes();

            if (queuePrefixes.length === 0) {
                logger.warn('[TeamJobsService] No queues registered in QueueRegistry');
                return [];
            }

            const jobStatuses = await Promise.all(
                jobIds.map(async (jobId) => {
                    // Try each prefix until we find the job
                    for (const prefix of queuePrefixes) {
                        const status = await this.jobRepository.getJobStatus(`${prefix}${jobId}`);
                        if (status) {
                            return status;
                        }
                    }
                    return null;
                })
            );

            const validJobs = jobStatuses.filter(job => job !== null && job !== undefined);
            const grouped = this.groupJobsByTrajectory(validJobs);

            return grouped;
        } catch (error) {
            logger.error(error, `[TeamJobsService] Error fetching team jobs`);
            return [];
        }
    }

    private groupJobsByTrajectory(jobs: any[]): TrajectoryJobGroup[] {
        const trajectoryMap = new Map<string, any[]>();

        // Group by trajectoryId
        for (const job of jobs) {
            const trajectoryId = job.trajectoryId || 'unknown';
            if (!trajectoryMap.has(trajectoryId)) {
                trajectoryMap.set(trajectoryId, []);
            }
            trajectoryMap.get(trajectoryId)!.push(job);
        }

        // Convert to TrajectoryJobGroup format
        const groups: TrajectoryJobGroup[] = [];

        for (const [trajectoryId, trajectoryJobs] of trajectoryMap.entries()) {
            const frameMap = new Map<number, any[]>();

            // Group by timestep within trajectory
            for (const job of trajectoryJobs) {
                const timestep = job.timestep ?? 0;
                if (!frameMap.has(timestep)) {
                    frameMap.set(timestep, []);
                }
                frameMap.get(timestep)!.push(job);
            }

            // Convert frames to FrameJobGroup
            const frameGroups: FrameJobGroup[] = [];
            for (const [timestep, jobs] of frameMap.entries()) {
                const overallStatus = this.computeFrameStatus(jobs);
                frameGroups.push({
                    timestep,
                    jobs,
                    overallStatus
                });
            }

            // Sort frames by timestep descending (newest first)
            frameGroups.sort((a, b) => b.timestep - a.timestep);

            // Compute overall trajectory status
            const allJobs = trajectoryJobs;
            const overallStatus = this.computeFrameStatus(allJobs);
            const completedCount = allJobs.filter(j => j.status === 'completed').length;

            groups.push({
                trajectoryId,
                trajectoryName: trajectoryJobs[0]?.message || `Trajectory ${trajectoryId.slice(-6)}`,
                frameGroups,
                latestTimestamp: trajectoryJobs[0]?.timestamp || new Date().toISOString(),
                overallStatus,
                completedCount,
                totalCount: allJobs.length
            });
        }

        // Sort trajectories by latest timestamp descending
        groups.sort((a, b) =>
            new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime()
        );

        return groups;
    }

    private computeFrameStatus(jobs: any[]): string {
        const hasRunning = jobs.some(j => j.status === 'running');
        const hasQueued = jobs.some(j => j.status === 'queued' || j.status === 'retrying');
        const hasFailed = jobs.some(j => j.status === 'failed');
        const allCompleted = jobs.every(j => j.status === 'completed');

        if (hasRunning) return 'running';
        if (hasQueued) return 'queued';
        if (allCompleted) return 'completed';
        if (hasFailed && jobs.filter(j => j.status === 'completed').length === 0) return 'failed';
        return 'partial';
    }
}
