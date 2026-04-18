import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import TeamJobsService, { type TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import type IORedis from 'ioredis';
import { inject, injectable } from 'tsyringe';
import type {
    ClearTeamJobsHistoryResult,
    ITeamJobMaintenanceService,
    RemoveTeamRunningJobsResult,
    RetryTeamFailedJobsResult,
    TeamClusterFailureDetail
} from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { IEventBus } from '@shared/application/events/IEventBus';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';

interface ClusterActionResponse {
    affectedJobs: number;
};

interface ClusterMutationResult {
    affectedJobs: number;
    affectedClusters: number;
    confirmedAnalysisIds: Set<string>;
    clusterFailures: TeamClusterFailureDetail[];
    allClustersConfirmed: boolean;
};

interface LocalMutationResult {
    affectedJobs: number;
    affectedAnalysisIds: Set<string>;
};

interface LocalProjectedJobTarget {
    jobId: string;
    analysisId?: string;
    status?: string;
};

interface PartitionedVisibleJobs {
    daemonJobs: TeamJobSummary[];
    localJobs: TeamJobSummary[];
};

@injectable()
export default class TeamJobMaintenanceService implements ITeamJobMaintenanceService {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(TEAM_TOKENS.TeamJobsService)
        private readonly teamJobsService: TeamJobsService
    ) {}

    async clearHistory(teamId: string): Promise<ClearTeamJobsHistoryResult> {
        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        const localCleanupTargets = await this.collectLocalCleanupTargets(teamId, teamJobs);
        const localResult = await this.removeProjectedJobs(teamId, localCleanupTargets);

        return {
            deletedJobs: localResult.affectedJobs,
            deletedAnalyses: localResult.affectedAnalysisIds.size,
            affectedClusters: 0,
            clusterFailures: []
        };
    }

    async removeRunningJobs(teamId: string): Promise<RemoveTeamRunningJobsResult> {
        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        const runningJobs = teamJobs.filter((job) => job.status === 'running');
        const { daemonJobs, localJobs } = this.partitionVisibleJobs(runningJobs);
        const localCleanupTargets = await this.collectLocalCleanupTargets(teamId, localJobs, 'running');
        const daemonResult = await this.callPerCluster(this.groupJobsByCluster(daemonJobs), (teamClusterId, jobIds) => {
            return this.teamClusterDaemonClient.command<ClusterActionResponse>(teamClusterId, ChannelCommands.JobsRemoveRunning, {
                jobIds
            });
        }, {
            requireFullConfirmation: true
        });
        const localResult = daemonResult.allClustersConfirmed
            ? await this.removeProjectedJobs(teamId, localCleanupTargets)
            : this.emptyLocalMutationResult();
        const deletedAnalyses = this.combineAnalysisIds(
            daemonResult.confirmedAnalysisIds,
            localResult.affectedAnalysisIds
        );

        return {
            deletedJobs: daemonResult.affectedJobs + localResult.affectedJobs,
            deletedAnalyses: deletedAnalyses.size,
            affectedClusters: daemonResult.affectedClusters,
            clusterFailures: daemonResult.clusterFailures
        };
    }

    async retryFailedJobs(teamId: string, jobIds?: string[]): Promise<RetryTeamFailedJobsResult> {
        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        const failedJobs = teamJobs.filter((job) => {
            if (job.status !== 'failed') {
                return false;
            }

            if (!jobIds || jobIds.length === 0) {
                return true;
            }

            return jobIds.includes(job.jobId);
        });
        const { daemonJobs } = this.partitionVisibleJobs(failedJobs);
        const jobsByCluster = this.groupJobsByCluster(daemonJobs);
        let retriedFrames = 0;
        let affectedClusters = 0;
        const clusterFailures: TeamClusterFailureDetail[] = [];

        for (const [teamClusterId, jobs] of jobsByCluster.entries()) {
            try {
                const response = await this.teamClusterDaemonClient.command<ClusterActionResponse>(
                    teamClusterId,
                    ChannelCommands.JobsRetry,
                    {
                        jobIds: jobs.map((job) => job.jobId)
                    }
                );
                const confirmedAffectedJobs = this.normalizeAffectedJobs(response.affectedJobs, jobs.length);

                if (confirmedAffectedJobs !== jobs.length) {
                    clusterFailures.push({
                        teamClusterId,
                        requestedJobs: jobs.length,
                        affectedJobs: confirmedAffectedJobs,
                        reason: 'partial-confirmation',
                        message: `Cluster confirmed ${confirmedAffectedJobs} of ${jobs.length} requested job retries`
                    });
                } else {
                    await Promise.all(jobs.map(async (job) => {
                        await this.resetRetriedDaemonJobState(job);
                        await this.publishRetriedDaemonJob(job);
                    }));
                }

                affectedClusters += 1;
                retriedFrames += confirmedAffectedJobs;
            } catch (error) {
                clusterFailures.push({
                    teamClusterId,
                    requestedJobs: jobs.length,
                    affectedJobs: 0,
                    reason: 'command-failed',
                    message: this.getErrorMessage(error)
                });
                logger.warn(error, `[TeamJobMaintenanceService] Failed to retry jobs on cluster ${teamClusterId}`);
            }
        }

        return {
            retriedFrames,
            affectedClusters,
            clusterFailures
        };
    }

    private async callPerCluster(
        jobsByCluster: Map<string, TeamJobSummary[]>,
        handler: (teamClusterId: string, jobIds: string[]) => Promise<ClusterActionResponse>,
        options: {
            requireFullConfirmation?: boolean;
        } = {}
    ): Promise<ClusterMutationResult> {
        let affectedJobs = 0;
        let affectedClusters = 0;
        const confirmedAnalysisIds = new Set<string>();
        const clusterFailures: TeamClusterFailureDetail[] = [];
        const requireFullConfirmation = options.requireFullConfirmation === true;

        for (const [teamClusterId, jobs] of jobsByCluster.entries()) {
            try {
                const response = await handler(teamClusterId, jobs.map((job) => job.jobId));
                const confirmedAffectedJobs = this.normalizeAffectedJobs(response.affectedJobs, jobs.length);

                if (confirmedAffectedJobs !== jobs.length) {
                    logger.warn(`[TeamJobMaintenanceService] Cluster returned partial confirmation for job action teamClusterId=${teamClusterId} requestedJobs=${jobs.length} affectedJobs=${confirmedAffectedJobs}`);
                    clusterFailures.push({
                        teamClusterId,
                        requestedJobs: jobs.length,
                        affectedJobs: confirmedAffectedJobs,
                        reason: 'partial-confirmation',
                        message: `Cluster confirmed ${confirmedAffectedJobs} of ${jobs.length} requested job mutations`
                    });
                }

                affectedClusters += 1;

                if (confirmedAffectedJobs === jobs.length) {
                    this.addAnalysisIds(confirmedAnalysisIds, jobs);
                }

                affectedJobs += requireFullConfirmation && confirmedAffectedJobs !== jobs.length
                    ? 0
                    : confirmedAffectedJobs;
            } catch (error) {
                clusterFailures.push({
                    teamClusterId,
                    requestedJobs: jobs.length,
                    affectedJobs: 0,
                    reason: 'command-failed',
                    message: this.getErrorMessage(error)
                });
                logger.warn(error, `[TeamJobMaintenanceService] Failed to perform job action on cluster ${teamClusterId}`);
            }
        }

        return {
            affectedJobs,
            affectedClusters,
            confirmedAnalysisIds,
            clusterFailures,
            allClustersConfirmed: clusterFailures.length === 0
        };
    }

    private emptyLocalMutationResult(): LocalMutationResult {
        return {
            affectedJobs: 0,
            affectedAnalysisIds: new Set<string>()
        };
    }

    private partitionVisibleJobs(teamJobs: TeamJobSummary[]): PartitionedVisibleJobs {
        const daemonJobs: TeamJobSummary[] = [];
        const localJobs: TeamJobSummary[] = [];

        for (const job of teamJobs) {
            if (this.isDaemonJob(job)) {
                daemonJobs.push(job);
                continue;
            }

            localJobs.push(job);
        }

        return {
            daemonJobs,
            localJobs
        };
    }

    private groupJobsByCluster(teamJobs: TeamJobSummary[]): Map<string, TeamJobSummary[]> {
        const grouped = new Map<string, TeamJobSummary[]>();

        for (const job of teamJobs) {
            if (!job.teamClusterId) {
                throw new Error(`[TeamJobMaintenanceService] Missing teamClusterId for daemon job ${job.jobId}`);
            }

            const clusterJobs = grouped.get(job.teamClusterId) || [];
            clusterJobs.push(job);
            grouped.set(job.teamClusterId, clusterJobs);
        }

        return grouped;
    }

    private async collectLocalCleanupTargets(
        teamId: string,
        visibleLocalJobs: TeamJobSummary[],
        requiredStatus?: string
    ): Promise<LocalProjectedJobTarget[]> {
        const cleanupTargets = new Map<string, LocalProjectedJobTarget>();

        for (const job of visibleLocalJobs) {
            cleanupTargets.set(job.jobId, {
                jobId: job.jobId,
                analysisId: job.analysisId,
                status: job.status
            });
        }

        const indexedProjectedJobs = await this.loadProjectedIndexedJobs(teamId);
        for (const indexedJob of indexedProjectedJobs) {
            const existingTarget = cleanupTargets.get(indexedJob.jobId);
            cleanupTargets.set(indexedJob.jobId, {
                jobId: indexedJob.jobId,
                analysisId: indexedJob.analysisId ?? existingTarget?.analysisId,
                status: indexedJob.status ?? existingTarget?.status
            });
        }

        const targets = Array.from(cleanupTargets.values());

        if (!requiredStatus) {
            return targets;
        }

        return targets.filter((target) => target.status === requiredStatus);
    }

    private async loadProjectedIndexedJobs(teamId: string): Promise<LocalProjectedJobTarget[]> {
        const projectedJobIds = await this.redis.smembers(this.projectedTeamJobsKey(teamId));

        if (projectedJobIds.length === 0) {
            return [];
        }

        const records = await this.redis.mget(projectedJobIds.map((jobId) => this.jobStatusKey(jobId)));
        const indexedJobs: LocalProjectedJobTarget[] = [];

        for (const [index, jobId] of projectedJobIds.entries()) {
            const parsedRecord = this.parseProjectedJobRecord(jobId, records[index]);
            indexedJobs.push(parsedRecord);
        }

        return indexedJobs;
    }

    private parseProjectedJobRecord(jobId: string, record: string | null): LocalProjectedJobTarget {
        if (!record) {
            return { jobId };
        }

        const parsedRecord = JSON.parse(record) as TeamJobSummary;

        return {
            jobId,
            analysisId: parsedRecord.analysisId,
            status: parsedRecord.status
        };
    }

    private async removeProjectedJobs(teamId: string, cleanupTargets: LocalProjectedJobTarget[]): Promise<LocalMutationResult> {
        if (cleanupTargets.length === 0) {
            return {
                affectedJobs: 0,
                affectedAnalysisIds: new Set<string>()
            };
        }

        const pipeline = this.redis.pipeline();
        const analysisIdsByJobId = new Map<string, string | undefined>();

        for (const target of cleanupTargets) {
            const analysisId = target.analysisId;

            analysisIdsByJobId.set(target.jobId, analysisId);
            pipeline.del(this.jobStatusKey(target.jobId));
            pipeline.srem(this.projectedTeamJobsKey(teamId), target.jobId);

            if (analysisId) {
                pipeline.srem(this.projectedAnalysisJobsKey(analysisId), target.jobId);
            }
        }

        pipeline.incr(this.projectedTeamJobsRevisionKey(teamId));

        const results = await pipeline.exec();
        const affectedAnalysisIds = new Set<string>();

        if (!results) {
            return {
                affectedJobs: 0,
                affectedAnalysisIds
            };
        }

        let affectedJobs = 0;
        let resultIndex = 0;

        for (const target of cleanupTargets) {
            const analysisId = analysisIdsByJobId.get(target.jobId);
            let jobAffected = false;

            jobAffected = this.didRedisMutationAffect(results[resultIndex]) || jobAffected;
            resultIndex += 1;
            jobAffected = this.didRedisMutationAffect(results[resultIndex]) || jobAffected;
            resultIndex += 1;
            jobAffected = this.didRedisMutationAffect(results[resultIndex]) || jobAffected;
            resultIndex += 1;

            if (analysisId) {
                jobAffected = this.didRedisMutationAffect(results[resultIndex]) || jobAffected;
                resultIndex += 1;
            }

            if (!jobAffected) {
                continue;
            }

            affectedJobs += 1;

            if (analysisId) {
                affectedAnalysisIds.add(analysisId);
            }
        }

        return {
            affectedJobs,
            affectedAnalysisIds
        };
    }

    private isDaemonJob(job: TeamJobSummary): boolean {
        return typeof job.teamClusterId === 'string'
            && job.teamClusterId.length > 0
            && job.backingSource === 'daemon';
    }

    private async resetRetriedDaemonJobState(job: TeamJobSummary): Promise<void> {
        const { analysisId, trajectoryId } = job;
        const pipeline = this.redis.pipeline();

        if (job.queueType === 'analysis_processing' && analysisId) {
            const terminalReceiptKey = this.analysisTerminalReceiptKey(analysisId, job.jobId);
            pipeline.del(terminalReceiptKey);
            pipeline.srem(this.analysisTerminalReceiptSetKey(analysisId), terminalReceiptKey);
        }

        if (job.queueType === 'trajectory_glb_conversion' && trajectoryId) {
            const terminalReceiptKey = this.glbTerminalReceiptKey(trajectoryId, job.jobId);
            pipeline.del(terminalReceiptKey);
            pipeline.srem(this.glbTerminalReceiptSetKey(trajectoryId), terminalReceiptKey);
        }

        await pipeline.exec();
    }

    private async publishRetriedDaemonJob(job: TeamJobSummary): Promise<void> {
        await this.eventBus.publish(new JobStatusChangedEvent({
            ...job,
            jobId: job.jobId,
            teamId: job.teamId,
            status: 'retrying',
            queueType: job.queueType,
            source: 'projected',
            backingSource: 'daemon',
            message: undefined,
            error: undefined
        }));
    }

    private normalizeAffectedJobs(affectedJobs: number, requestedJobs: number): number {
        if (!Number.isFinite(affectedJobs)) {
            return 0;
        }

        return Math.max(0, Math.min(requestedJobs, Math.trunc(affectedJobs)));
    }

    private getErrorMessage(error: unknown): string | undefined {
        if (error instanceof Error && error.message.trim().length > 0) {
            return error.message;
        }

        return undefined;
    }

    private didRedisMutationAffect(result: [Error | null, unknown] | undefined): boolean {
        if (!result) {
            return false;
        }

        const [error, value] = result;
        if (error) {
            return false;
        }

        return typeof value === 'number' && value > 0;
    }

    private combineAnalysisIds(...analysisIdSets: Array<Set<string>>): Set<string> {
        const combined = new Set<string>();

        for (const analysisIds of analysisIdSets) {
            for (const analysisId of analysisIds) {
                combined.add(analysisId);
            }
        }

        return combined;
    }

    private addAnalysisIds(analysisIds: Set<string>, teamJobs: TeamJobSummary[]): void {
        for (const job of teamJobs) {
            const analysisId = job.analysisId;
            if (analysisId) {
                analysisIds.add(analysisId);
            }
        }
    }

    private jobStatusKey(jobId: string): string {
        return `${JOB_STATUS_KEY_PREFIX}${jobId}`;
    }

    private projectedTeamJobsKey(teamId: string): string {
        return `team:${teamId}:projected-jobs`;
    }

    private projectedTeamJobsRevisionKey(teamId: string): string {
        return `team:${teamId}:projected-jobs:revision`;
    }

    private projectedAnalysisJobsKey(analysisId: string): string {
        return `analysis:${analysisId}:projected-jobs`;
    }

    private analysisTerminalReceiptKey(analysisId: string, jobId: string): string {
        return `daemon-analysis:${analysisId}:terminal:${jobId}`;
    }

    private analysisTerminalReceiptSetKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:terminal-keys`;
    }

    private glbTerminalReceiptKey(trajectoryId: string, jobId: string): string {
        return `daemon-glb:${trajectoryId}:terminal:${jobId}`;
    }

    private glbTerminalReceiptSetKey(trajectoryId: string): string {
        return `daemon-glb:${trajectoryId}:terminal-keys`;
    }
}
