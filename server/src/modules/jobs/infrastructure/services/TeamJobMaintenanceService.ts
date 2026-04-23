import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type {
    ITeamJobMaintenanceService,
    RemoveTeamJobsResult,
    RetryTeamJobsResult,
    TeamClusterFailureDetail
} from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import TeamJobsService, { type TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import TrajectoryBackgroundProcessor from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryBackgroundProcessor';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type IORedis from 'ioredis';
import { inject } from 'tsyringe';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const TOMBSTONE_TTL_SECONDS = 600;

const REMOVABLE_STATUSES = new Set<string>([
    JobStatus.Queued,
    JobStatus.Running,
    'retrying'
]);

interface ClusterActionResponse {
    affectedJobs: number;
    affectedJobIds: string[];
};

interface PartitionedJobs {
    daemonJobs: TeamJobSummary[];
    localJobs: TeamJobSummary[];
};

@Singleton()
export default class TeamJobMaintenanceService implements ITeamJobMaintenanceService {
    constructor(
        
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        
        private readonly teamJobsService: TeamJobsService,

        
        private readonly trajectoryBackgroundProcessor: TrajectoryBackgroundProcessor
    ) {}

    async removeJobs(teamId: string, jobIds: string[]): Promise<RemoveTeamJobsResult> {
        if (jobIds.length === 0) {
            return this.emptyRemoveResult();
        }

        const targetJobs = await this.resolveJobs(teamId, jobIds);
        if (targetJobs.length === 0) {
            return this.emptyRemoveResult();
        }

        const { daemonJobs, localJobs } = this.partitionByBackingSource(targetJobs);
        const clusterFailures: TeamClusterFailureDetail[] = [];
        const clustersReached = new Set<string>();

        for (const [teamClusterId, clusterJobs] of this.groupByCluster(daemonJobs)) {
            const requestedJobIds = clusterJobs.map((job) => job.jobId);
            try {
                const response = await this.teamClusterDaemonClient.command<ClusterActionResponse>(
                    teamClusterId,
                    ChannelCommands.JobsRemoveRunning,
                    { jobIds: requestedJobIds }
                );
                const affectedSet = new Set(response.affectedJobIds ?? []);
                const affectedClusterJobs = clusterJobs.filter((job) => affectedSet.has(job.jobId));

                if (affectedClusterJobs.length !== clusterJobs.length) {
                    clusterFailures.push({
                        teamClusterId,
                        requestedJobs: clusterJobs.length,
                        affectedJobs: affectedClusterJobs.length,
                        reason: 'partial-confirmation',
                        message: `Cluster confirmed ${affectedClusterJobs.length} of ${clusterJobs.length} requested job removals`
                    });
                }

                clustersReached.add(teamClusterId);
            } catch (error) {
                clusterFailures.push({
                    teamClusterId,
                    requestedJobs: clusterJobs.length,
                    affectedJobs: 0,
                    reason: 'command-failed',
                    message: this.getErrorMessage(error)
                });
                logger.warn(error, `[TeamJobMaintenanceService] Failed to remove jobs on cluster ${teamClusterId}`);
            }
        }

        const jobsToDrop = [
            ...localJobs,
            ...daemonJobs.filter((job) => job.teamClusterId && clustersReached.has(job.teamClusterId))
        ];
        const deletion = await this.dropProjectedJobs(teamId, jobsToDrop);

        return {
            deletedJobs: deletion.deletedJobs,
            deletedAnalyses: deletion.deletedAnalyses,
            affectedClusters: clustersReached.size,
            clusterFailures
        };
    }

    async removeJobsForAnalysis(teamId: string, analysisId: string): Promise<RemoveTeamJobsResult> {
        const jobIds = await this.collectJobIdsMatching(teamId, (job) => job.analysisId === analysisId);
        if (jobIds.length === 0) {
            return this.emptyRemoveResult();
        }

        return this.removeJobs(teamId, jobIds);
    }

    async removeJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RemoveTeamJobsResult> {
        const jobIds = await this.collectJobIdsMatching(
            teamId,
            (job) => job.trajectoryId === trajectoryId && REMOVABLE_STATUSES.has(job.status)
        );
        if (jobIds.length === 0) {
            return this.emptyRemoveResult();
        }

        return this.removeJobs(teamId, jobIds);
    }

    async retryFailedJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RetryTeamJobsResult> {
        const jobIds = await this.collectJobIdsMatching(
            teamId,
            (job) => job.trajectoryId === trajectoryId && job.status === JobStatus.Failed
        );
        if (jobIds.length === 0) {
            return this.emptyRetryResult();
        }

        return this.retryJobs(teamId, jobIds);
    }

    private async collectJobIdsMatching(
        teamId: string,
        predicate: (job: TeamJobSummary) => boolean
    ): Promise<string[]> {
        if (!teamId) {
            return [];
        }

        const jobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        return jobs.filter(predicate).map((job) => job.jobId);
    }

    async retryJobs(teamId: string, jobIds: string[]): Promise<RetryTeamJobsResult> {
        if (jobIds.length === 0) {
            return this.emptyRetryResult();
        }

        const targetJobs = await this.resolveJobs(teamId, jobIds);
        const { daemonJobs } = this.partitionByBackingSource(targetJobs);

        if (daemonJobs.length === 0) {
            return this.emptyRetryResult();
        }

        const clusterFailures: TeamClusterFailureDetail[] = [];
        let retriedFrames = 0;
        let affectedClusters = 0;

        for (const [teamClusterId, clusterJobs] of this.groupByCluster(daemonJobs)) {
            const requestedJobIds = clusterJobs.map((job) => job.jobId);
            try {
                const response = await this.teamClusterDaemonClient.command<ClusterActionResponse>(
                    teamClusterId,
                    ChannelCommands.JobsRetry,
                    { jobIds: requestedJobIds }
                );
                const affectedSet = new Set(response.affectedJobIds ?? []);
                const retriedJobs = clusterJobs.filter((job) => affectedSet.has(job.jobId));
                const missingJobs = clusterJobs.filter((job) => !affectedSet.has(job.jobId));
                const recoveredJobIds = await this.requeueMissingGlbJobs(teamId, missingJobs);
                const recoveredJobs = missingJobs.filter((job) => recoveredJobIds.has(job.jobId));
                const confirmedJobs = [...retriedJobs, ...recoveredJobs];

                if (confirmedJobs.length !== clusterJobs.length) {
                    clusterFailures.push({
                        teamClusterId,
                        requestedJobs: clusterJobs.length,
                        affectedJobs: confirmedJobs.length,
                        reason: 'partial-confirmation',
                        message: `Cluster confirmed or recovered ${confirmedJobs.length} of ${clusterJobs.length} requested job retries`
                    });
                }

                if (confirmedJobs.length > 0) {
                    affectedClusters += 1;
                }
                retriedFrames += confirmedJobs.length;

                await Promise.all(retriedJobs.map(async (job) => {
                    await this.resetRetriedDaemonJobState(job);
                    await this.publishRetriedDaemonJob(job);
                }));
            } catch (error) {
                clusterFailures.push({
                    teamClusterId,
                    requestedJobs: clusterJobs.length,
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

    private async requeueMissingGlbJobs(teamId: string, jobs: TeamJobSummary[]): Promise<Set<string>> {
        const groupedByTrajectory = new Map<string, TeamJobSummary[]>();

        for (const job of jobs) {
            if (
                job.queueType !== 'trajectory_glb_conversion'
                || !job.trajectoryId
                || typeof job.timestep !== 'number'
            ) {
                continue;
            }

            const bucket = groupedByTrajectory.get(job.trajectoryId) ?? [];
            bucket.push(job);
            groupedByTrajectory.set(job.trajectoryId, bucket);
        }

        const recoveredJobIds = new Set<string>();

        for (const [trajectoryId, trajectoryJobs] of groupedByTrajectory.entries()) {
            const timesteps = [
                ...new Set(
                    trajectoryJobs
                        .map((job) => job.timestep)
                        .filter((value): value is number => typeof value === 'number')
                )
            ];

            try {
                await Promise.all(trajectoryJobs.map(async (job) => {
                    await this.resetRetriedDaemonJobState(job);
                    await this.publishRetriedDaemonJob(job);
                }));

                const requeuedJobIds = await this.trajectoryBackgroundProcessor.requeueGlbPreprocessing({
                    teamId,
                    trajectoryId,
                    timesteps
                });

                for (const jobId of requeuedJobIds) {
                    recoveredJobIds.add(jobId);
                }
            } catch (error) {
                logger.warn(error, `[TeamJobMaintenanceService] Failed to requeue persisted GLB jobs for trajectory ${trajectoryId}`);
            }
        }

        return recoveredJobIds;
    }

    private async resolveJobs(teamId: string, jobIds: string[]): Promise<TeamJobSummary[]> {
        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        const targetSet = new Set(jobIds);

        return teamJobs.filter((job) => targetSet.has(job.jobId));
    }

    private partitionByBackingSource(jobs: TeamJobSummary[]): PartitionedJobs {
        const daemonJobs: TeamJobSummary[] = [];
        const localJobs: TeamJobSummary[] = [];

        for (const job of jobs) {
            if (this.isDaemonJob(job)) {
                daemonJobs.push(job);
                continue;
            }

            localJobs.push(job);
        }

        return { daemonJobs, localJobs };
    }

    private groupByCluster(jobs: TeamJobSummary[]): Map<string, TeamJobSummary[]> {
        const grouped = new Map<string, TeamJobSummary[]>();

        for (const job of jobs) {
            if (!job.teamClusterId) {
                throw new Error(`[TeamJobMaintenanceService] Missing teamClusterId for daemon job ${job.jobId}`);
            }

            const bucket = grouped.get(job.teamClusterId) ?? [];
            bucket.push(job);
            grouped.set(job.teamClusterId, bucket);
        }

        return grouped;
    }

    private async dropProjectedJobs(
        teamId: string,
        jobs: TeamJobSummary[]
    ): Promise<{ deletedJobs: number; deletedAnalyses: number }> {
        if (jobs.length === 0) {
            return { deletedJobs: 0, deletedAnalyses: 0 };
        }

        const pipeline = this.redis.pipeline();
        const analysisIdsByJobId = new Map<string, string | undefined>();

        for (const job of jobs) {
            const analysisId = job.analysisId;
            analysisIdsByJobId.set(job.jobId, analysisId);

            pipeline.del(this.jobStatusKey(job.jobId));
            pipeline.srem(this.projectedTeamJobsKey(teamId), job.jobId);
            pipeline.set(this.jobTombstoneKey(job.jobId), '1', 'EX', TOMBSTONE_TTL_SECONDS);

            if (analysisId) {
                pipeline.srem(this.projectedAnalysisJobsKey(analysisId), job.jobId);
            }
        }

        pipeline.incr(this.projectedTeamJobsRevisionKey(teamId));

        const results = await pipeline.exec();
        if (!results) {
            return { deletedJobs: 0, deletedAnalyses: 0 };
        }

        let deletedJobs = 0;
        const deletedAnalyses = new Set<string>();
        let index = 0;

        for (const job of jobs) {
            const analysisId = analysisIdsByJobId.get(job.jobId);
            const delResult = this.didRedisMutationAffect(results[index]);
            index += 1;
            // srem projected-jobs
            this.didRedisMutationAffect(results[index]);
            index += 1;
            // set tombstone (no counted affect)
            index += 1;

            if (analysisId) {
                this.didRedisMutationAffect(results[index]);
                index += 1;
            }

            if (delResult) {
                deletedJobs += 1;
                if (analysisId) {
                    deletedAnalyses.add(analysisId);
                }
            }
        }

        return {
            deletedJobs,
            deletedAnalyses: deletedAnalyses.size
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

    private emptyRemoveResult(): RemoveTeamJobsResult {
        return {
            deletedJobs: 0,
            deletedAnalyses: 0,
            affectedClusters: 0,
            clusterFailures: []
        };
    }

    private emptyRetryResult(): RetryTeamJobsResult {
        return {
            retriedFrames: 0,
            affectedClusters: 0,
            clusterFailures: []
        };
    }

    private jobStatusKey(jobId: string): string {
        return `${JOB_STATUS_KEY_PREFIX}${jobId}`;
    }

    private jobTombstoneKey(jobId: string): string {
        return `jobs:removed:${jobId}`;
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
