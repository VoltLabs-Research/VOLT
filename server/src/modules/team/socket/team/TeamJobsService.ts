import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

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

interface DaemonTeamJobsResponse {
    data: TeamJobSummary[];
};

@injectable()
export default class TeamJobsService {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
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

        const clusterJobs = await this.getClusterTeamJobs(teamId);
        for (const job of clusterJobs) {
            jobsById.set(job.jobId, job);
        }

        return Array.from(jobsById.values()).sort((left, right) => {
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
                const response = await this.teamClusterDaemonClient.request<DaemonTeamJobsResponse>(
                    teamCluster.id,
                    '/api/jobs',
                    {
                        query: { teamId }
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
