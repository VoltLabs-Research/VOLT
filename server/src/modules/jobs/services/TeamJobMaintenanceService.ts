import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import type {
    ITeamJobMaintenanceService,
    RemoveTeamJobsResult,
    RetryTeamJobsResult,
    TeamClusterFailureDetail
} from '@shared/contracts/ports/ITeamJobMaintenanceService';
import TeamJobsService, { type TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import type { AnalysisDeletedEventPayload } from '@shared/contracts/events/AnalysisDeletedPayload';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events/TrajectoryDeletedPayload';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';
import logger from '@shared/infrastructure/logger';
import {
    collectCleanupClusterIds,
    distinctJobIds,
    getErrorMessage,
    groupByCluster,
    isDaemonJob,
    partitionByBackingSource
} from '@modules/jobs/services/team-job-maintenance-helpers';
import {
    dropProjectedJobs,
    purgeAnalysisRuntimeState,
    purgeTrajectoryRuntimeState
} from '@modules/jobs/services/job-runtime-state';
import { retryTeamJobs } from '@modules/jobs/services/team-job-retry';

const REMOVABLE_STATUSES = new Set<string>([
    JobStatus.Queued,
    JobStatus.Running,
    JobStatus.Retrying
]);

interface PurgedJobScope {
    jobIds: string[];
    daemonClusterIds: string[];
}

class TeamJobMaintenanceService implements ITeamJobMaintenanceService {
    private readonly teamJobsService = new TeamJobsService();

    async removeJobsForAnalysis(teamId: string, analysisId: string): Promise<RemoveTeamJobsResult> {
        return this.removeResolvedJobs(teamId, await this.collectJobsMatching(
            teamId,
            (job) => job.analysisId === analysisId
        ));
    }

    async removeJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RemoveTeamJobsResult> {
        return this.removeResolvedJobs(teamId, await this.collectJobsMatching(
            teamId,
            (job) => job.trajectoryId === trajectoryId && REMOVABLE_STATUSES.has(job.status)
        ));
    }

    async retryJobs(teamId: string, jobIds: string[]): Promise<RetryTeamJobsResult> {
        const targetIds = new Set(jobIds);
        return retryTeamJobs(teamId, await this.collectJobsMatching(teamId, (job) => targetIds.has(job.jobId)));
    }

    async retryFailedJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RetryTeamJobsResult> {
        return retryTeamJobs(teamId, await this.collectJobsMatching(
            teamId,
            (job) => job.trajectoryId === trajectoryId && job.status === JobStatus.Failed
        ));
    }

    async cleanupDeletedTrajectory(
        input: Pick<
            TrajectoryDeletedEventPayload,
            'teamId' | 'trajectoryId' | 'storageClusterId' | 'analysisIds' | 'analysisComputeClusterIds'
        >
    ): Promise<void> {
        const analysisIds = input.analysisIds ?? [];
        const purged = await this.purgeJobScope(input.teamId, (job) => job.trajectoryId === input.trajectoryId);

        await Promise.all([
            purgeTrajectoryRuntimeState(input.teamId, input.trajectoryId),
            ...[...new Set(analysisIds)].map((analysisId) => purgeAnalysisRuntimeState(analysisId))
        ]);

        await Promise.all(collectCleanupClusterIds(
            input.storageClusterId,
            input.analysisComputeClusterIds ?? [],
            purged.daemonClusterIds
        ).map((teamClusterId) => this.cleanupRemoteRuntimeState(
            teamClusterId,
            ChannelCommands.TrajectoryCleanupRuntimeState,
            {
                trajectoryId: input.trajectoryId,
                analysisIds,
                jobIds: purged.jobIds
            }
        )));
    }

    async cleanupDeletedAnalysis(
        input: Pick<AnalysisDeletedEventPayload, 'analysisId' | 'teamId' | 'computeClusterId'>
    ): Promise<void> {
        const purged = await this.purgeJobScope(input.teamId, (job) => job.analysisId === input.analysisId);

        await purgeAnalysisRuntimeState(input.analysisId);

        await Promise.all(collectCleanupClusterIds(
            input.computeClusterId,
            [],
            purged.daemonClusterIds
        ).map((teamClusterId) => this.cleanupRemoteRuntimeState(
            teamClusterId,
            ChannelCommands.AnalysisCleanupRuntimeState,
            {
                analysisId: input.analysisId,
                jobIds: purged.jobIds
            }
        )));
    }

    private async collectJobsMatching(
        teamId: string,
        predicate: (job: TeamJobSummary) => boolean
    ): Promise<TeamJobSummary[]> {
        const jobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        return jobs.filter(predicate);
    }

    private async removeResolvedJobs(teamId: string, targetJobs: TeamJobSummary[]): Promise<RemoveTeamJobsResult> {
        const { daemonJobs, localJobs } = partitionByBackingSource(targetJobs);
        const clusterFailures: TeamClusterFailureDetail[] = [];
        const clustersReached = new Set<string>();

        for (const [teamClusterId, clusterJobs] of groupByCluster(daemonJobs)) {
            try {
                const response = await teamClusterDaemonClient.command<{ affectedJobIds: string[] }>(
                    teamClusterId,
                    ChannelCommands.JobsRemoveRunning,
                    { jobIds: clusterJobs.map((job) => job.jobId) }
                );
                const affectedSet = new Set(response.affectedJobIds);
                const affectedCount = clusterJobs.filter((job) => affectedSet.has(job.jobId)).length;

                if (affectedCount !== clusterJobs.length) {
                    clusterFailures.push({
                        teamClusterId,
                        requestedJobs: clusterJobs.length,
                        affectedJobs: affectedCount,
                        reason: 'partial-confirmation',
                        message: `Cluster confirmed ${affectedCount} of ${clusterJobs.length} requested job removals`
                    });
                }

                clustersReached.add(teamClusterId);
            } catch (error) {
                clusterFailures.push({
                    teamClusterId,
                    requestedJobs: clusterJobs.length,
                    affectedJobs: 0,
                    reason: 'command-failed',
                    message: getErrorMessage(error)
                });
                logger.warn(error, `[TeamJobMaintenanceService] Failed to remove jobs on cluster ${teamClusterId}`);
            }
        }

        const deletion = await dropProjectedJobs(teamId, [
            ...localJobs,
            ...daemonJobs.filter((job) => job.teamClusterId && clustersReached.has(job.teamClusterId))
        ]);

        return {
            deletedJobs: deletion.deletedJobs,
            deletedAnalyses: deletion.deletedAnalyses,
            affectedClusters: clustersReached.size,
            clusterFailures
        };
    }

    private async purgeJobScope(
        teamId: string,
        predicate: (job: TeamJobSummary) => boolean
    ): Promise<PurgedJobScope> {
        const targetJobs = await this.collectJobsMatching(teamId, predicate);
        const daemonClusterIds = await this.stopDaemonJobsBestEffort(
            targetJobs.filter((job) => REMOVABLE_STATUSES.has(job.status))
        );

        await dropProjectedJobs(teamId, targetJobs, false);

        return {
            jobIds: distinctJobIds(targetJobs),
            daemonClusterIds
        };
    }

    private async stopDaemonJobsBestEffort(targetJobs: TeamJobSummary[]): Promise<string[]> {
        const grouped = groupByCluster(targetJobs.filter(isDaemonJob));

        await Promise.all([...grouped].map(async ([teamClusterId, clusterJobs]) => {
            try {
                await teamClusterDaemonClient.command(
                    teamClusterId,
                    ChannelCommands.JobsRemoveRunning,
                    { jobIds: clusterJobs.map((job) => job.jobId) }
                );
            } catch (error) {
                logger.warn(
                    error,
                    `[TeamJobMaintenanceService] Failed to stop daemon jobs during deletion cleanup on cluster ${teamClusterId}`
                );
            }
        }));

        return [...grouped.keys()];
    }

    private async cleanupRemoteRuntimeState(
        teamClusterId: string,
        command: string,
        payload: Record<string, unknown>
    ): Promise<void> {
        try {
            await teamClusterDaemonClient.command(teamClusterId, command, payload);
        } catch (error) {
            logger.warn(
                error,
                `[TeamJobMaintenanceService] Failed to purge runtime state on cluster ${teamClusterId} command=${command}`
            );
        }
    }
}

export default new TeamJobMaintenanceService();
