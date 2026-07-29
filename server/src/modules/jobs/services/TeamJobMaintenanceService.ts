import eventBus from '@shared/infrastructure/events/RedisEventBus';
import redisClient from '@shared/infrastructure/redis/redisClient';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import { JobStatus } from '@shared/contracts/types/JobStatus';
import type {
    ITeamJobMaintenanceService,
    RemoveTeamJobsResult,
    RetryTeamJobsResult,
    TeamClusterFailureDetail
} from '@shared/contracts/ports/ITeamJobMaintenanceService';
import TeamJobsService, { type TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';
import type {
    AnalysisDeletedEventPayload,
    TrajectoryDeletedEventPayload
} from '@shared/contracts/events';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import trajectoryDumpStorageService from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import {
    collectCleanupClusterIds,
    didRedisMutationAffect,
    distinctJobIds as toDistinctJobIds,
    emptyRemoveResult,
    emptyRetryResult,
    getErrorMessage,
    groupByCluster,
    partitionByBackingSource,
} from '@modules/jobs/services/team-job-maintenance-helpers';
import {
    analysisFailedKey,
    analysisRemainingKey,
    analysisTerminalReceiptKey,
    analysisTerminalReceiptSetKey,
    canvasWorkspaceIndexKey,
    canvasWorkspaceKey,
    glbFailedKey,
    glbRemainingKey,
    glbTerminalReceiptKey,
    glbTerminalReceiptSetKey,
    jupyterTrajectoryLockKey,
} from '@modules/jobs/services/JobRedisKeys';
import {
    jobStatusKey,
    jobTombstoneKey,
    projectedTeamJobsKey,
    projectedTeamJobsRevisionKey,
    projectedAnalysisJobsKey
} from '@modules/jobs/services/JobRedisKeys';

const TOMBSTONE_TTL_SECONDS = 600;

interface MaintenanceTrajectoryDumpStorage {
    getObjectName(trajectoryId: string, timestep: string): string;
}

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

class TeamJobMaintenanceService implements ITeamJobMaintenanceService {
    private readonly dumpStorage: MaintenanceTrajectoryDumpStorage = trajectoryDumpStorageService;

        private readonly teamClusterDaemonClient = teamClusterDaemonClient;

        private readonly redis = redisClient;

        private readonly eventBus = eventBus;

    #teamJobsServiceCache?: TeamJobsService;
    private get teamJobsService(): TeamJobsService {
        return (this.#teamJobsServiceCache ??= new TeamJobsService());
    }

    private async removeResolvedJobs(teamId: string, targetJobs: TeamJobSummary[]): Promise<RemoveTeamJobsResult> {
        if (targetJobs.length === 0) {
            return emptyRemoveResult();
        }

        const { daemonJobs, localJobs } = partitionByBackingSource(targetJobs);
        const clusterFailures: TeamClusterFailureDetail[] = [];
        const clustersReached = new Set<string>();

        for (const [teamClusterId, clusterJobs] of groupByCluster(daemonJobs)) {
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
                    message: getErrorMessage(error)
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
        const distinctJobIds = toDistinctJobIds(allTargetJobs);
        const daemonClusterIds = await this.stopDaemonJobsBestEffort(removableJobs);

        await this.dropProjectedJobs(input.teamId, allTargetJobs, {
            preserveJobTombstones: false
        });

        await Promise.all([
            this.cleanupLocalTrajectoryRuntimeState(input.teamId, input.trajectoryId),
            this.cleanupLocalAnalysisSessionStates(input.analysisIds ?? [])
        ]);

        const cleanupClusterIds = collectCleanupClusterIds(
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
        const allTargetJobs = await this.collectJobsMatching(
            input.teamId,
            (job) => job.analysisId === input.analysisId
        );
        const removableJobs = allTargetJobs.filter((job) => REMOVABLE_STATUSES.has(job.status));
        const distinctJobIds = toDistinctJobIds(allTargetJobs);
        const daemonClusterIds = await this.stopDaemonJobsBestEffort(removableJobs);

        await this.dropProjectedJobs(input.teamId, allTargetJobs, {
            preserveJobTombstones: false
        });

        await this.cleanupLocalAnalysisSessionState(input.analysisId);

        const cleanupClusterIds = collectCleanupClusterIds(
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
        const jobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        return jobs.filter(predicate);
    }

    async retryJobs(teamId: string, jobIds: string[]): Promise<RetryTeamJobsResult> {
        if (jobIds.length === 0) {
            return emptyRetryResult();
        }

        const targetJobs = await this.resolveJobs(teamId, jobIds);
        return this.retryResolvedJobs(teamId, targetJobs);
    }

    private async retryResolvedJobs(teamId: string, targetJobs: TeamJobSummary[]): Promise<RetryTeamJobsResult> {
        if (targetJobs.length === 0) {
            return emptyRetryResult();
        }

        const { daemonJobs } = partitionByBackingSource(targetJobs);

        if (daemonJobs.length === 0) {
            return emptyRetryResult();
        }

        const clusterFailures: TeamClusterFailureDetail[] = [];
        let retriedFrames = 0;
        let affectedClusters = 0;

        for (const [teamClusterId, clusterJobs] of groupByCluster(daemonJobs)) {
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
                    message: getErrorMessage(error)
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

    private async requeueGlbPreprocessing(input: {
        trajectoryId: string;
        teamId: string;
        timesteps?: number[];
    }): Promise<string[]> {
        const trajectory = await Trajectory.findOneBy({ id: input.trajectoryId });
        if(!trajectory){
            logger.warn(`[TeamJobMaintenanceService] requeue skipped — trajectory not found trajectoryId=${input.trajectoryId}`);
            return [];
        }

        const storageClusterId = trajectory.storageClusterId;
        if(!storageClusterId){
            logger.warn(`[TeamJobMaintenanceService] requeue skipped — no storageClusterId trajectoryId=${input.trajectoryId}`);
            return [];
        }

        const persistedFrames = await TrajectoryFrame.find({
            where: { trajectoryId: input.trajectoryId },
            select: { timestep: true }
        });
        if(persistedFrames.length === 0){
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



    private async dropProjectedJobs(
        teamId: string,
        jobs: TeamJobSummary[],
        options: { preserveJobTombstones?: boolean } = {}
    ): Promise<{ deletedJobs: number; deletedAnalyses: number }> {
        if (jobs.length === 0) {
            return {
                deletedJobs: 0,
                deletedAnalyses: 0
            };
        }

        const preserveJobTombstones = options.preserveJobTombstones ?? true;
        const pipeline = this.redis.pipeline();
        const analysisIdsByJobId = new Map<string, string | undefined>();

        for (const job of jobs) {
            const analysisId = job.analysisId;
            analysisIdsByJobId.set(job.jobId, analysisId);

            pipeline.del(jobStatusKey(job.jobId));
            pipeline.srem(projectedTeamJobsKey(teamId), job.jobId);
            if (preserveJobTombstones) {
                pipeline.set(jobTombstoneKey(job.jobId), '1', 'EX', TOMBSTONE_TTL_SECONDS);
            } else {
                pipeline.del(jobTombstoneKey(job.jobId));
            }

            if (analysisId) {
                pipeline.srem(projectedAnalysisJobsKey(analysisId), job.jobId);
            }
        }

        pipeline.incr(projectedTeamJobsRevisionKey(teamId));

        const results = await pipeline.exec();
        if (!results) {
            return {
                deletedJobs: 0,
                deletedAnalyses: 0
            };
        }

        let deletedJobs = 0;
        const deletedAnalyses = new Set<string>();
        let index = 0;

        for (const job of jobs) {
            const analysisId = analysisIdsByJobId.get(job.jobId);
            const delResult = didRedisMutationAffect(results[index]);
            index += 1;
            index += 1;
            index += 1;

            if (analysisId) {
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
        const { daemonJobs } = partitionByBackingSource(targetJobs);
        if (daemonJobs.length === 0) {
            return [];
        }

        const grouped = groupByCluster(daemonJobs);

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
            this.redis.smembers(glbTerminalReceiptSetKey(trajectoryId)),
            this.redis.smembers(canvasWorkspaceIndexKey(trajectoryId))
        ]);
        const pipeline = this.redis.pipeline();

        pipeline.del(glbRemainingKey(trajectoryId));
        pipeline.del(glbFailedKey(trajectoryId));
        pipeline.del(glbTerminalReceiptSetKey(trajectoryId));
        pipeline.del(jupyterTrajectoryLockKey(teamId, trajectoryId));
        pipeline.del(canvasWorkspaceIndexKey(trajectoryId));

        for (const terminalKey of glbTerminalKeys) {
            pipeline.del(terminalKey);
        }

        for (const ownerId of canvasOwnerIds) {
            pipeline.del(canvasWorkspaceKey(trajectoryId, ownerId));
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
        const terminalKeys = await this.redis.smembers(analysisTerminalReceiptSetKey(analysisId));
        const pipeline = this.redis.pipeline();

        pipeline.del(analysisRemainingKey(analysisId));
        pipeline.del(analysisFailedKey(analysisId));
        pipeline.del(analysisTerminalReceiptSetKey(analysisId));

        for (const terminalKey of terminalKeys) {
            pipeline.del(terminalKey);
        }

        await pipeline.exec();
    }




    private async resetRetriedDaemonJobState(job: TeamJobSummary): Promise<void> {
        const { analysisId, trajectoryId } = job;
        const pipeline = this.redis.pipeline();

        if (job.queueType === 'analysis_processing' && analysisId) {
            const terminalReceiptKey = analysisTerminalReceiptKey(analysisId, job.jobId);
            pipeline.del(terminalReceiptKey);
            pipeline.srem(analysisTerminalReceiptSetKey(analysisId), terminalReceiptKey);
        }

        if (job.queueType === 'trajectory_glb_conversion' && trajectoryId) {
            const terminalReceiptKey = glbTerminalReceiptKey(trajectoryId, job.jobId);
            pipeline.del(terminalReceiptKey);
            pipeline.srem(glbTerminalReceiptSetKey(trajectoryId), terminalReceiptKey);
        }

        await pipeline.exec();
    }

    private async publishRetriedDaemonJob(job: TeamJobSummary): Promise<void> {
        await this.eventBus.emit('job.status.changed', {
            ...job,
            jobId: job.jobId,
            teamId: job.teamId,
            status: JobStatus.Retrying,
            queueType: job.queueType,
            source: 'projected',
            backingSource: 'daemon',
            message: undefined,
            error: undefined
        });
    }





}

export default new TeamJobMaintenanceService();
