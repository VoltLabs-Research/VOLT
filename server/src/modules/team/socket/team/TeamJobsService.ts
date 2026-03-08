import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { IJobRepository } from '@modules/jobs/domain/port/IJobRepository';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

type TeamJobStatus = JobStatus | 'retrying' | 'partial';

interface TeamJobMetadata {
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    analysisId?: string;
    message?: string;
    [key: string]: unknown;
};

interface TeamJobStatusRecord {
    jobId: string;
    teamId?: string;
    queueType?: string;
    status?: TeamJobStatus;
    sessionId?: string;
    message?: string;
    metadata?: TeamJobMetadata;
    timestamp?: string;
    createdAt?: string;
    updatedAt?: string;
    analysisId?: string;
    trajectoryId?: string;
    timestep?: number;
};

export interface TeamJobSummary extends TeamJobStatusRecord {
    jobId: string;
    queueType: string;
    status: TeamJobStatus;
    teamId: string;
    [key: string]: unknown;
};

interface TrajectoryJobGroup {
    trajectoryId: string;
    trajectoryName: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: string;
    completedCount: number;
    totalCount: number;
};

interface FrameJobGroup {
    timestep: number;
    jobs: TeamJobSummary[];
    overallStatus: string;
};

@injectable()
export default class TeamJobsService {
    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository,

        @inject(JOBS_TOKENS.QueueRegistry)
        private readonly queueRegistry: IQueueRegistry
    ) { }

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

            const statusKeys = queuePrefixes.flatMap((prefix) =>
                jobIds.map((jobId) => `${prefix}${jobId}`)
            );

            const jobStatuses = await this.jobRepository.getJobStatuses(statusKeys);

            const validJobs: TeamJobSummary[] = [];
            for (const job of jobStatuses) {
                if (this.isTeamJobSummary(job)) {
                    validJobs.push(job);
                }
            }

            const grouped = this.groupJobsByTrajectory(validJobs);

            return grouped;
        } catch (error) {
            logger.error(error, `[TeamJobsService] Error fetching team jobs`);
            return [];
        }
    }

    async getFlatTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const groupedJobs = await this.getTeamJobs(teamId);
        const jobsById = new Map<string, TeamJobSummary>();

        for (const trajectory of groupedJobs) {
            for (const frameGroup of trajectory.frameGroups) {
                for (const job of frameGroup.jobs) {
                    jobsById.set(job.jobId, job);
                }
            }
        }

        return Array.from(jobsById.values());
    }

    private groupJobsByTrajectory(jobs: TeamJobSummary[]): TrajectoryJobGroup[] {
        const trajectoryMap = new Map<string, TeamJobSummary[]>();

        // Group by trajectoryId
        for (const job of jobs) {
            const trajectoryId = job.trajectoryId || job.metadata?.trajectoryId || 'unknown';
            if (!trajectoryMap.has(trajectoryId)) {
                trajectoryMap.set(trajectoryId, []);
            }
            trajectoryMap.get(trajectoryId)!.push(job);
        }

        // Convert to TrajectoryJobGroup format
        const groups: TrajectoryJobGroup[] = [];

        for (const [trajectoryId, trajectoryJobs] of trajectoryMap.entries()) {
            const frameMap = new Map<number, TeamJobSummary[]>();

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
            const completedCount = allJobs.filter((job) => job.status === JobStatus.Completed).length;

            groups.push({
                trajectoryId,
                trajectoryName: trajectoryJobs[0]?.message || trajectoryJobs[0]?.metadata?.trajectoryName || `Trajectory ${trajectoryId.slice(-6)}`,
                frameGroups,
                latestTimestamp: trajectoryJobs[0]?.timestamp || trajectoryJobs[0]?.createdAt || new Date().toISOString(),
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

    private computeFrameStatus(jobs: TeamJobSummary[]): TeamJobStatus {
        const hasRunning = jobs.some((job) => job.status === JobStatus.Running);
        const hasQueued = jobs.some((job) => job.status === JobStatus.Queued || job.status === 'retrying');
        const hasFailed = jobs.some((job) => job.status === JobStatus.Failed);
        const allCompleted = jobs.every((job) => job.status === JobStatus.Completed);

        if (hasRunning) return JobStatus.Running;
        if (hasQueued) return JobStatus.Queued;
        if (allCompleted) return JobStatus.Completed;
        if (hasFailed && jobs.filter((job) => job.status === JobStatus.Completed).length === 0) return JobStatus.Failed;
        return 'partial';
    }

    private isTeamJobSummary(job: Record<string, unknown> | null): job is TeamJobSummary {
        return Boolean(
            job
            && typeof job.jobId === 'string'
            && typeof job.teamId === 'string'
            && typeof job.queueType === 'string'
            && this.isTeamJobStatus(job.status)
        );
    }

    private isTeamJobStatus(status: unknown): status is TeamJobStatus {
        return status === JobStatus.Queued
            || status === JobStatus.Running
            || status === JobStatus.Completed
            || status === JobStatus.Failed
            || status === 'retrying'
            || status === 'partial';
    }
};
