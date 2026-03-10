import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamJobQueryService from '@modules/jobs/infrastructure/services/TeamJobQueryService';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type {
    ClearTeamJobsHistoryResult,
    ITeamJobMaintenanceService,
    RemoveTeamRunningJobsResult,
    RetryTeamFailedJobsResult
} from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface ClusterActionResponse {
    affectedJobs: number;
};

@injectable()
export default class TeamJobMaintenanceService implements ITeamJobMaintenanceService {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(JOBS_TOKENS.TeamJobQueryService)
        private readonly teamJobQueryService: TeamJobQueryService
    ) {}

    async clearHistory(teamId: string): Promise<ClearTeamJobsHistoryResult> {
        const teamJobs = await this.teamJobQueryService.getFlatTeamJobs(teamId);
        const analysisIds = this.collectAnalysisIds(teamJobs);
        const jobIdsByCluster = this.groupJobIdsByCluster(teamJobs);
        const affectedClusters = await this.callPerCluster(jobIdsByCluster, (teamClusterId, jobIds) => {
            return this.teamClusterDaemonClient.request<ClusterActionResponse>(teamClusterId, '/api/jobs/history', {
                method: 'DELETE',
                body: {
                    teamId,
                    jobIds
                }
            });
        });

        return {
            deletedJobs: teamJobs.length,
            deletedAnalyses: analysisIds.size,
            affectedClusters
        };
    }

    async removeRunningJobs(teamId: string): Promise<RemoveTeamRunningJobsResult> {
        const teamJobs = await this.teamJobQueryService.getFlatTeamJobs(teamId);
        const runningJobs = teamJobs.filter((job) => job.status === 'running');
        const analysisIds = this.collectAnalysisIds(runningJobs);
        const jobIdsByCluster = this.groupJobIdsByCluster(runningJobs);
        const affectedClusters = await this.callPerCluster(jobIdsByCluster, (teamClusterId, jobIds) => {
            return this.teamClusterDaemonClient.request<ClusterActionResponse>(teamClusterId, '/api/jobs/remove-running', {
                method: 'POST',
                body: {
                    jobIds
                }
            });
        });

        return {
            deletedJobs: runningJobs.length,
            deletedAnalyses: analysisIds.size,
            affectedClusters
        };
    }

    async retryFailedJobs(teamId: string, jobIds?: string[]): Promise<RetryTeamFailedJobsResult> {
        const teamJobs = await this.teamJobQueryService.getFlatTeamJobs(teamId);
        const failedJobs = teamJobs.filter((job) => {
            if (job.status !== 'failed') {
                return false;
            }

            if (!jobIds || jobIds.length === 0) {
                return true;
            }

            return jobIds.includes(job.jobId);
        });
        const jobIdsByCluster = this.groupJobIdsByCluster(failedJobs);
        const affectedClusters = await this.callPerCluster(jobIdsByCluster, (teamClusterId, jobIds) => {
            return this.teamClusterDaemonClient.request<ClusterActionResponse>(teamClusterId, '/api/jobs/retry', {
                method: 'POST',
                body: {
                    jobIds
                }
            });
        });

        return {
            retriedFrames: failedJobs.length,
            affectedClusters
        };
    }

    private async callPerCluster(
        jobIdsByCluster: Map<string, string[]>,
        handler: (teamClusterId: string, jobIds: string[]) => Promise<ClusterActionResponse>
    ): Promise<number> {
        let affectedClusters = 0;

        for (const [teamClusterId, jobIds] of jobIdsByCluster.entries()) {
            try {
                await handler(teamClusterId, jobIds);
                affectedClusters += 1;
            } catch (error) {
                logger.warn(error, `[TeamJobMaintenanceService] Failed to perform job action on cluster ${teamClusterId}`);
            }
        }

        return affectedClusters;
    }

    private groupJobIdsByCluster(teamJobs: Array<{ jobId: string; teamClusterId?: string }>): Map<string, string[]> {
        const grouped = new Map<string, string[]>();

        for (const job of teamJobs) {
            if (!job.teamClusterId) {
                continue;
            }

            const clusterJobIds = grouped.get(job.teamClusterId) || [];
            clusterJobIds.push(job.jobId);
            grouped.set(job.teamClusterId, clusterJobIds);
        }

        return grouped;
    }

    private collectAnalysisIds(teamJobs: Array<{ analysisId?: string; metadata?: Record<string, unknown> }>): Set<string> {
        const analysisIds = new Set<string>();

        for (const job of teamJobs) {
            if (typeof job.analysisId === 'string') {
                analysisIds.add(job.analysisId);
                continue;
            }

            if (typeof job.metadata?.analysisId === 'string') {
                analysisIds.add(job.metadata.analysisId);
            }
        }

        return analysisIds;
    }
}
