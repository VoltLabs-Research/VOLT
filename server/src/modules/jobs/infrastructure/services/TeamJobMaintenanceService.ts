import type { AnalysisDeletedEventPayload } from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type {
    ITeamJobMaintenanceService,
    RemoveTeamJobsResult,
    RetryTeamJobsResult,
    TeamClusterFailureDetail
} from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import TeamJobsService, { type TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import type { TrajectoryDeletedEventPayload } from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
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
    JobStatus.Retrying
]);

interface ClusterActionResponse {
    affectedJobs: number;
    affectedJobIds: string[];
}

interface RuntimeCleanupResponse {
    deletedKeys: number;
}

interface PartitionedJobs {
    daemonJobs: TeamJobSummary[];
    localJobs: TeamJobSummary[];
}

interface GlbPreprocessingEnqueueResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
}

interface GlbFrameDescriptor {
    timestep: number;
    objectKey: string;
    ownerClusterId: string;
}

@Singleton()
export default class TeamJobMaintenanceService implements ITeamJobMaintenanceService {
    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,
        private readonly teamJobsService: TeamJobsService,
        private readonly trajectoryRepo: TrajectoryRepository,
        private readonly trajectoryFrameRepo: TrajectoryFrameRepository,
        private readonly dumpStorage: TrajectoryDumpStorageService
    ) {}

    private async removeResolvedJobs(teamId: string, targetJobs: TeamJobSummary[]): Promise<RemoveTeamJobsResult> {
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
        const targetJobs = await this.collectJobsMatching(teamId, (job) => job.analysisId === analysisId);
        return this.removeResolvedJobs(teamId, targetJobs);
    }

    async removeJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RemoveTeamJobsResult> {
        const targetJobs = await this.collectJobsMatching(
            teamId,
            (job) => job.trajectoryId === trajectoryId && REMOVABLE_STATUSES.has(job.status)
        );
        return this.removeResolvedJobs(teamId, targetJobs);
    }

    async cleanupDeletedTrajectory(
        input: Pick<
            TrajectoryDeletedEventPayload,
            'teamId' | 'trajectoryId' | 'storageClusterId' | 'analysisIds' | 'analysisComputeClusterIds'
        >
    ): Promise<void> {
        if (!input.teamId) {
            return;
        }

        const allTargetJobs = await this.collectJobsMatching(
            input.teamId,
            (job) => job.trajectoryId === input.trajectoryId
        );
        const removableJobs = allTargetJobs.filter((job) => REMOVABLE_STATUSES.has(job.status));
        const distinctJobIds = this.distinctJobIds(allTargetJobs);
        const daemonClusterIds = await this.stopDaemonJobsBestEffort(removableJobs);

        await this.dropProjectedJobs(input.teamId, allTargetJobs, {
            preserveJobTombstones: false
        });

        await Promise.all([
            this.cleanupLocalTrajectoryRuntimeState(input.teamId, input.trajectoryId),
            this.cleanupLocalAnalysisSessionStates(input.analysisIds ?? [])
        ]);

        const cleanupClusterIds = this.collectCleanupClusterIds(
            input.storageClusterId,
            input.analysisComputeClusterIds ?? [],
            daemonClusterIds
        );

        await Promise.all(cleanupClusterIds.map((teamClusterId) =>
            this.cleanupRemoteTrajectoryRuntimeState(teamClusterId, {
                trajectoryId: input.trajectoryId,
                analysisIds: input.analysisIds ?? [],
                jobIds: distinctJobIds
            })
        ));
    }

    async cleanupDeletedAnalysis(
        input: Pick<AnalysisDeletedEventPayload, 'analysisId' | 'teamId' | 'computeClusterId'>
    ): Promise<void> {
        const allTargetJobs = input.teamId
            ? await this.collectJobsMatching(
                input.teamId,
                (job) => job.analysisId === input.analysisId
            )
            : [];
        const removableJobs = allTargetJobs.filter((job) => REMOVABLE_STATUSES.has(job.status));
        const distinctJobIds = this.distinctJobIds(allTargetJobs);
        const daemonClusterIds = await this.stopDaemonJobsBestEffort(removableJobs);

        if (input.teamId) {
            await this.dropProjectedJobs(input.teamId, allTargetJobs, {
                preserveJobTombstones: false
            });
        }

        await this.cleanupLocalAnalysisSessionState(input.analysisId);

        const cleanupClusterIds = this.collectCleanupClusterIds(
            input.computeClusterId,
            [],
            daemonClusterIds
        );

        await Promise.all(cleanupClusterIds.map((teamClusterId) =>
            this.cleanupRemoteAnalysisRuntimeState(teamClusterId, {
                analysisId: input.analysisId,
                jobIds: distinctJobIds
            })
        ));
    }

    async retryFailedJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RetryTeamJobsResult> {
        const targetJobs = await this.collectJobsMatching(
            teamId,
            (job) => job.trajectoryId === trajectoryId && job.status === JobStatus.Failed
        );
        return this.retryResolvedJobs(teamId, targetJobs);
    }

    private async collectJobsMatching(
        teamId: string,
        predicate: (job: TeamJobSummary) => boolean
    ): Promise<TeamJobSummary[]> {
        if (!teamId) {
            return [];
        }

        const jobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        return jobs.filter(predicate);
    }

    async retryJobs(teamId: string, jobIds: string[]): Promise<RetryTeamJobsResult> {
        if (jobIds.length === 0) {
            return this.emptyRetryResult();
        }

        const targetJobs = await this.resolveJobs(teamId, jobIds);
        return this.retryResolvedJobs(teamId, targetJobs);
    }

    private async retryResolvedJobs(teamId: string, targetJobs: TeamJobSummary[]): Promise<RetryTeamJobsResult> {
        if (targetJobs.length === 0) {
            return this.emptyRetryResult();
        }

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

                const requeuedJobIds = await this.requeueGlbPreprocessing({
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

    /**
     * Requeues GLB preprocessing for specific timesteps by directly calling
     * the daemon's trajectory.enqueue-preprocessing command.
     */
    private async requeueGlbPreprocessing(input: {
        trajectoryId: string;
        teamId: string;
        timesteps?: number[];
    }): Promise<string[]> {
        const trajectory = await this.trajectoryRepo.findById(input.trajectoryId);
        if (!trajectory) {
            logger.warn(`[TeamJobMaintenanceService] requeue skipped — trajectory not found trajectoryId=${input.trajectoryId}`);
            return [];
        }

        const storageClusterId = trajectory.props.storageClusterId;
        if (!storageClusterId) {
            logger.warn(`[TeamJobMaintenanceService] requeue skipped — no storageClusterId trajectoryId=${input.trajectoryId}`);
            return [];
        }

        const persistedFrames = await this.trajectoryFrameRepo.getFrames(input.trajectoryId);
        if (persistedFrames.length === 0) {
            logger.warn(`[TeamJobMaintenanceService] requeue skipped — no persisted frames trajectoryId=${input.trajectoryId}`);
            return [];
        }

        const requestedTimesteps = input.timesteps && input.timesteps.length > 0
            ? new Set(input.timesteps)
            : null;

        const frames = persistedFrames
            .filter((frame) => requestedTimesteps?.has(frame.timestep) ?? true);

        if (frames.length === 0) {
            return [];
        }

        const frameDescriptors: GlbFrameDescriptor[] = frames.map((frame) => ({
            timestep: frame.timestep,
            objectKey: this.dumpStorage.getObjectName(input.trajectoryId, String(frame.timestep)),
            ownerClusterId: storageClusterId
        }));

        await this.teamClusterDaemonClient.command<GlbPreprocessingEnqueueResult>(
            storageClusterId,
            ChannelCommands.TrajectoryEnqueuePreprocessing,
            {
                trajectoryId: input.trajectoryId,
                teamId: input.teamId,
                storageClusterId,
                frames: frameDescriptors
            },
            { timeoutClass: 'long-running-control-plane' }
        );

        return frameDescriptors.map((frame) => `trajectory-glb:${input.trajectoryId}:${frame.timestep}`);
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
        jobs: TeamJobSummary[],
        options: { preserveJobTombstones?: boolean } = {}
    ): Promise<{ deletedJobs: number; deletedAnalyses: number }> {
        if (jobs.length === 0) {
            return { deletedJobs: 0, deletedAnalyses: 0 };
        }

        const preserveJobTombstones = options.preserveJobTombstones ?? true;
        const pipeline = this.redis.pipeline();
        const analysisIdsByJobId = new Map<string, string | undefined>();

        for (const job of jobs) {
            const analysisId = job.analysisId;
            analysisIdsByJobId.set(job.jobId, analysisId);

            pipeline.del(this.jobStatusKey(job.jobId));
            pipeline.srem(this.projectedTeamJobsKey(teamId), job.jobId);
            if (preserveJobTombstones) {
                pipeline.set(this.jobTombstoneKey(job.jobId), '1', 'EX', TOMBSTONE_TTL_SECONDS);
            } else {
                pipeline.del(this.jobTombstoneKey(job.jobId));
            }

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
            // tombstone mutation (no counted affect)
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

    private async stopDaemonJobsBestEffort(targetJobs: TeamJobSummary[]): Promise<string[]> {
        const { daemonJobs } = this.partitionByBackingSource(targetJobs);
        if (daemonJobs.length === 0) {
            return [];
        }

        const grouped = this.groupByCluster(daemonJobs);

        await Promise.all(Array.from(grouped.entries()).map(async ([teamClusterId, clusterJobs]) => {
            try {
                await this.teamClusterDaemonClient.command<ClusterActionResponse>(
                    teamClusterId,
                    ChannelCommands.JobsRemoveRunning,
                    {
                        jobIds: clusterJobs.map((job) => job.jobId)
                    }
                );
            } catch (error) {
                logger.warn(
                    error,
                    `[TeamJobMaintenanceService] Failed to stop daemon jobs during deletion cleanup on cluster ${teamClusterId}`
                );
            }
        }));

        return Array.from(grouped.keys());
    }

    private async cleanupRemoteTrajectoryRuntimeState(
        teamClusterId: string,
        payload: { trajectoryId: string; analysisIds: string[]; jobIds: string[] }
    ): Promise<void> {
        try {
            await this.teamClusterDaemonClient.command<RuntimeCleanupResponse>(
                teamClusterId,
                ChannelCommands.TrajectoryCleanupRuntimeState,
                payload
            );
        } catch (error) {
            logger.warn(
                error,
                `[TeamJobMaintenanceService] Failed to purge trajectory runtime state on cluster ${teamClusterId} trajectoryId=${payload.trajectoryId}`
            );
        }
    }

    private async cleanupRemoteAnalysisRuntimeState(
        teamClusterId: string,
        payload: { analysisId: string; jobIds: string[] }
    ): Promise<void> {
        try {
            await this.teamClusterDaemonClient.command<RuntimeCleanupResponse>(
                teamClusterId,
                ChannelCommands.AnalysisCleanupRuntimeState,
                payload
            );
        } catch (error) {
            logger.warn(
                error,
                `[TeamJobMaintenanceService] Failed to purge analysis runtime state on cluster ${teamClusterId} analysisId=${payload.analysisId}`
            );
        }
    }

    private async cleanupLocalTrajectoryRuntimeState(teamId: string, trajectoryId: string): Promise<void> {
        const [glbTerminalKeys, canvasOwnerIds] = await Promise.all([
            this.redis.smembers(this.glbTerminalReceiptSetKey(trajectoryId)),
            this.redis.smembers(this.canvasWorkspaceIndexKey(trajectoryId))
        ]);
        const pipeline = this.redis.pipeline();

        pipeline.del(this.glbRemainingKey(trajectoryId));
        pipeline.del(this.glbFailedKey(trajectoryId));
        pipeline.del(this.glbTerminalReceiptSetKey(trajectoryId));
        pipeline.del(this.jupyterTrajectoryLockKey(teamId, trajectoryId));
        pipeline.del(this.canvasWorkspaceIndexKey(trajectoryId));

        for (const terminalKey of glbTerminalKeys) {
            pipeline.del(terminalKey);
        }

        for (const ownerId of canvasOwnerIds) {
            pipeline.del(this.canvasWorkspaceKey(trajectoryId, ownerId));
        }

        await pipeline.exec();
    }

    private async cleanupLocalAnalysisSessionStates(analysisIds: string[]): Promise<void> {
        await Promise.all(
            [...new Set(analysisIds.filter((analysisId) => analysisId.trim().length > 0))]
                .map((analysisId) => this.cleanupLocalAnalysisSessionState(analysisId))
        );
    }

    private async cleanupLocalAnalysisSessionState(analysisId: string): Promise<void> {
        const terminalKeys = await this.redis.smembers(this.analysisTerminalReceiptSetKey(analysisId));
        const pipeline = this.redis.pipeline();

        pipeline.del(this.analysisRemainingKey(analysisId));
        pipeline.del(this.analysisFailedKey(analysisId));
        pipeline.del(this.analysisTerminalReceiptSetKey(analysisId));

        for (const terminalKey of terminalKeys) {
            pipeline.del(terminalKey);
        }

        await pipeline.exec();
    }

    private collectCleanupClusterIds(
        primaryClusterId: string | undefined,
        additionalClusterIds: string[],
        daemonClusterIds: string[]
    ): string[] {
        return [
            primaryClusterId,
            ...additionalClusterIds,
            ...daemonClusterIds
        ].filter((clusterId): clusterId is string => typeof clusterId === 'string' && clusterId.length > 0)
            .filter((clusterId, index, values) => values.indexOf(clusterId) === index);
    }

    private distinctJobIds(jobs: TeamJobSummary[]): string[] {
        return [...new Set(jobs.map((job) => job.jobId).filter((jobId) => jobId.trim().length > 0))];
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
            status: JobStatus.Retrying,
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

    private analysisRemainingKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:remaining`;
    }

    private analysisFailedKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:failed`;
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

    private glbRemainingKey(trajectoryId: string): string {
        return `daemon-glb:${trajectoryId}:remaining`;
    }

    private glbFailedKey(trajectoryId: string): string {
        return `daemon-glb:${trajectoryId}:failed`;
    }

    private canvasWorkspaceKey(trajectoryId: string, ownerId: string): string {
        return `canvas:workspace:${trajectoryId}:${ownerId}`;
    }

    private canvasWorkspaceIndexKey(trajectoryId: string): string {
        return `canvas:workspace:index:${trajectoryId}`;
    }

    private jupyterTrajectoryLockKey(teamId: string, trajectoryId: string): string {
        return `lock:jupyter:${teamId}:trajectory:${trajectoryId}`;
    }
}
