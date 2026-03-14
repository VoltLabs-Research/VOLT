import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import logger from '@shared/infrastructure/logger';
import IORedis from 'ioredis';
import { inject, injectable } from 'tsyringe';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';

type TeamJobStatus = JobStatus | 'retrying' | 'partial';

interface TeamJobMetadata {
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number | string;
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
    trajectoryName?: string;
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

interface DaemonTeamJobsResponse {
    data: TeamJobSummary[];
};

@injectable()
export default class TeamJobsService {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ) { }

    async getTeamJobs(teamId: string): Promise<TrajectoryJobGroup[]> {
        try {
            const grouped = this.groupJobsByTrajectory(await this.getFlatTeamJobs(teamId));

            return grouped;
        } catch (error) {
            logger.error(error, `[TeamJobsService] Error fetching team jobs`);
            return [];
        }
    }

    async getFlatTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const jobsById = new Map<string, TeamJobSummary>();

        const [clusterJobs, projectedJobs] = await Promise.all([
            this.getClusterTeamJobs(teamId),
            this.getProjectedTeamJobs(teamId)
        ]);

        for (const job of [...clusterJobs, ...projectedJobs]) {
            jobsById.set(job.jobId, job);
        }

        const enrichedJobs = await this.enrichTrajectoryNames(Array.from(jobsById.values()));

        return enrichedJobs.sort((left, right) => {
            const leftTimestamp = left.timestamp || left.updatedAt || left.createdAt || '';
            const rightTimestamp = right.timestamp || right.updatedAt || right.createdAt || '';
            return new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime();
        });
    }

    private async getClusterTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const teamClusters = await this.teamClusterRepository.findAll({
            filter: {
                team: teamId,
                status: TeamClusterStatus.Connected
            },
            page: 1,
            limit: 100
        });

        const jobs: TeamJobSummary[] = [];

        for (const teamCluster of teamClusters.data) {
            try {
                const response = await this.teamClusterDaemonClient.command<DaemonTeamJobsResponse>(
                    teamCluster.id,
                    'jobs.list',
                    {
                        teamId
                    }
                );

                for (const job of response.data || []) {
                    if (this.isTeamJobSummary(job)) {
                        jobs.push({
                            ...job,
                            teamClusterId: teamCluster.id
                        });
                    }
                }
            } catch (error) {
                logger.warn(error, `[TeamJobsService] Failed to fetch daemon jobs for cluster ${teamCluster.id}`);
            }
        }

        return jobs;
    }

    private async getProjectedTeamJobs(teamId: string): Promise<TeamJobSummary[]> {
        const jobIds = await this.redis.smembers(`team:${teamId}:jobs`);
        if (jobIds.length === 0) {
            return [];
        }

        const records = await this.redis.mget(jobIds.map((jobId) => `${JOB_STATUS_KEY_PREFIX}${jobId}`));
        const jobs: TeamJobSummary[] = [];

        for (const record of records) {
            if (!record) {
                continue;
            }

            try {
                const parsed = JSON.parse(record) as Record<string, unknown> | null;
                if (this.isTeamJobSummary(parsed)) {
                    jobs.push(parsed);
                }
            } catch {
                continue;
            }
        }

        return jobs;
    }

    private groupJobsByTrajectory(jobs: TeamJobSummary[]): TrajectoryJobGroup[] {
        const trajectoryMap = new Map<string, TeamJobSummary[]>();

        for (const job of jobs) {
            const trajectoryId = this.resolveTrajectoryId(job);
            const trajectoryName = this.resolveTrajectoryName(job);

            if (!trajectoryId || !trajectoryName) {
                continue;
            }

            if (!trajectoryMap.has(trajectoryId)) {
                trajectoryMap.set(trajectoryId, []);
            }

            trajectoryMap.get(trajectoryId)?.push({
                ...job,
                trajectoryId,
                trajectoryName
            });
        }

        const groups: TrajectoryJobGroup[] = [];

        for (const [trajectoryId, trajectoryJobs] of trajectoryMap.entries()) {
            const frameMap = new Map<number, TeamJobSummary[]>();
            const groupedJobs: TeamJobSummary[] = [];

            for (const job of trajectoryJobs) {
                const timestep = this.resolveJobTimestep(job);
                if (typeof timestep === 'undefined') {
                    continue;
                }

                if (!frameMap.has(timestep)) {
                    frameMap.set(timestep, []);
                }
                frameMap.get(timestep)?.push(job);
                groupedJobs.push(job);
            }

            if (groupedJobs.length === 0) {
                continue;
            }

            const frameGroups: FrameJobGroup[] = [];
            for (const [timestep, jobs] of frameMap.entries()) {
                const overallStatus = this.computeFrameStatus(jobs);
                frameGroups.push({
                    timestep,
                    jobs,
                    overallStatus
                });
            }

            frameGroups.sort((a, b) => b.timestep - a.timestep);

            const allJobs = groupedJobs;
            const overallStatus = this.computeFrameStatus(allJobs);
            const completedCount = allJobs.filter((job) => job.status === JobStatus.Completed).length;
            const trajectoryName = groupedJobs[0]?.trajectoryName;

            if (!trajectoryName) {
                continue;
            }

            groups.push({
                trajectoryId,
                trajectoryName,
                frameGroups,
                latestTimestamp: groupedJobs[0]?.timestamp || groupedJobs[0]?.createdAt || new Date().toISOString(),
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

    private async enrichTrajectoryNames(jobs: TeamJobSummary[]): Promise<TeamJobSummary[]> {
        const missingTrajectoryIds = Array.from(new Set(
            jobs
                .filter((job) => !this.resolveTrajectoryName(job))
                .map((job) => this.resolveTrajectoryId(job))
                .filter((trajectoryId): trajectoryId is string => typeof trajectoryId === 'string' && trajectoryId.length > 0)
        ));

        if (missingTrajectoryIds.length === 0) {
            return jobs;
        }

        const trajectoryNames = new Map<string, string>();
        await Promise.all(missingTrajectoryIds.map(async (trajectoryId) => {
            const trajectory = await this.trajectoryRepository.findById(trajectoryId);
            const trajectoryName = trajectory?.props.name;
            if (trajectoryName) {
                trajectoryNames.set(trajectoryId, trajectoryName);
            }
        }));

        return jobs.map((job) => {
            if (this.resolveTrajectoryName(job)) {
                return job;
            }

            const trajectoryId = this.resolveTrajectoryId(job);
            if (!trajectoryId) {
                return job;
            }

            const trajectoryName = trajectoryNames.get(trajectoryId);
            if (!trajectoryName) {
                return job;
            }

            return {
                ...job,
                trajectoryId,
                trajectoryName,
                metadata: {
                    ...job.metadata,
                    trajectoryId,
                    trajectoryName
                }
            };
        });
    }

    private resolveTrajectoryId(job: TeamJobSummary): string | undefined {
        if (typeof job.trajectoryId === 'string') {
            return job.trajectoryId;
        }

        if (typeof job.metadata?.trajectoryId === 'string') {
            return job.metadata.trajectoryId;
        }

        return undefined;
    }

    private resolveTrajectoryName(job: TeamJobSummary): string | undefined {
        if (typeof job.trajectoryName === 'string') {
            return job.trajectoryName;
        }

        if (typeof job.metadata?.trajectoryName === 'string') {
            return job.metadata.trajectoryName;
        }

        return undefined;
    }

    private resolveJobTimestep(job: TeamJobSummary): number | undefined {
        if (typeof job.timestep === 'number' && Number.isFinite(job.timestep)) {
            return job.timestep;
        }

        if (typeof job.metadata?.timestep === 'number' && Number.isFinite(job.metadata.timestep)) {
            return job.metadata.timestep;
        }

        if (typeof job.metadata?.timestep === 'string' && job.metadata.timestep.trim().length > 0) {
            const parsedTimestep = Number(job.metadata.timestep);
            if (Number.isFinite(parsedTimestep)) {
                return parsedTimestep;
            }
        }

        return undefined;
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
