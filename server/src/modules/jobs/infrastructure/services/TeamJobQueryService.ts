import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { TeamJobSnapshot, TeamJobStatus } from '@modules/jobs/infrastructure/projections/TeamJobSnapshot';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface DaemonTeamJobsResponse {
    data: TeamJobSnapshot[];
};

@injectable()
export default class TeamJobQueryService {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async getFlatTeamJobs(teamId: string): Promise<TeamJobSnapshot[]> {
        try {
            const jobsById = new Map<string, TeamJobSnapshot>();

            const clusterJobs = await this.getClusterTeamJobs(teamId);
            for (const jobStatus of clusterJobs) {
                jobsById.set(jobStatus.jobId, jobStatus);
            }

            return Array.from(jobsById.values()).sort((left, right) => {
                const leftTimestamp = left.timestamp || left.updatedAt || left.createdAt || '';
                const rightTimestamp = right.timestamp || right.updatedAt || right.createdAt || '';

                return new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime();
            });
        } catch (error) {
            logger.error(error, '[TeamJobQueryService] Error fetching team jobs');
            return [];
        }
    }

    private async getClusterTeamJobs(teamId: string): Promise<TeamJobSnapshot[]> {
        const teamClusters = await this.teamClusterRepository.findAll({
            filter: {
                team: teamId,
                status: TeamClusterStatus.Connected
            },
            page: 1,
            limit: 100
        });
        const jobs: TeamJobSnapshot[] = [];

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
                    if (this.isTeamJobSnapshot(job) && job.teamId === teamId) {
                        jobs.push({
                            ...job,
                            teamClusterId: teamCluster.id
                        });
                    }
                }
            } catch (error) {
                logger.warn(error, `[TeamJobQueryService] Failed to fetch daemon jobs for cluster ${teamCluster.id}`);
            }
        }

        return jobs;
    }

    private isTeamJobSnapshot(job: Record<string, unknown> | null): job is TeamJobSnapshot {
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
