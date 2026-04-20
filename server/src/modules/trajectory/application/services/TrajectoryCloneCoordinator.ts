import { SYS_BUCKETS } from '@core/config/minio';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent, { type JobStatusChangedValue } from '@modules/jobs/domain/events/JobStatusChangedEvent';
import StoragePlacementService from '@modules/team-cluster/application/services/StoragePlacementService';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TrajectoryCloneJob, { TrajectoryCloneJobProps, TrajectoryCloneJobState } from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryCloneJobRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryCloneJobRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import {
    buildTrajectoryDumpObjectName
} from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import { VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@shared/infrastructure/contracts/team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { Readable } from 'node:stream';

const isLocalCluster = (clusterId: string | null | undefined): boolean => {
    return !clusterId || clusterId === VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID;
};

const TRAJECTORY_CLONE_QUEUE_TYPE = 'trajectory_clone';
const PROGRESS_FLUSH_EVERY_FRAMES = 3;
const CLAIM_TTL_MS = 5 * 60 * 1000;
const CLAIM_RENEW_INTERVAL_MS = 60 * 1000;
const CLONE_WORKER_ID = `${process.pid}:${Math.random().toString(36).slice(2, 10)}`;

const OPEN_CLONE_JOB_STATES: TrajectoryCloneJobState[] = [
    'queued',
    'preparing',
    'copying'
];

const mapCloneStateToJobStatus = (state: TrajectoryCloneJobState): JobStatusChangedValue => {
    switch (state) {
        case 'completed':
            return JobStatus.Completed;
        case 'failed':
            return JobStatus.Failed;
        case 'queued':
            return JobStatus.Queued;
        default:
            return JobStatus.Running;
    }
};

const getCloneJobMessage = (job: TrajectoryCloneJob): string => {
    const { totalFrames, copiedFrames } = job.props.stats;
    switch (job.props.state) {
        case 'queued':
            return 'Clone queued';
        case 'preparing':
            return 'Preparing trajectory clone';
        case 'copying':
            return totalFrames > 0
                ? `Copying frames ${copiedFrames}/${totalFrames}`
                : 'Copying frames';
        case 'completed':
            return 'Trajectory cloned';
        case 'failed':
            return job.props.errorMessage || 'Clone failed';
        default:
            return 'Clone update';
    }
};

@injectable()
export default class TrajectoryCloneCoordinator {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryCloneJobRepository)
        private readonly cloneJobRepository: TrajectoryCloneJobRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementService)
        private readonly storagePlacementService: StoragePlacementService,

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async runPendingJobs(limit = 1): Promise<number> {
        let processed = 0;

        while (processed < limit) {
            const claimed = await this.cloneJobRepository.claimNextRunnable(CLONE_WORKER_ID, CLAIM_TTL_MS);
            if (!claimed) {
                break;
            }

            const renewTimer = setInterval(() => {
                void this.cloneJobRepository.renewClaim(
                    claimed.id,
                    CLONE_WORKER_ID,
                    CLAIM_TTL_MS
                ).catch((error) => {
                    logger.warn({ error, jobId: claimed.id }, '[TrajectoryCloneCoordinator] Failed to renew claim');
                });
            }, CLAIM_RENEW_INTERVAL_MS);
            renewTimer.unref?.();

            try {
                await this.executeJob(claimed.id);
            } finally {
                clearInterval(renewTimer);
                await this.cloneJobRepository.releaseClaim(claimed.id, CLONE_WORKER_ID).catch(() => undefined);
            }
            processed += 1;
        }

        return processed;
    }

    async executeJob(jobId: string): Promise<TrajectoryCloneJob> {
        const job = await this.cloneJobRepository.findById(jobId);
        if (!job) {
            throw ApplicationError.notFound('TrajectoryCloneJob::NotFound', 'Trajectory clone job not found');
        }

        if (!OPEN_CLONE_JOB_STATES.includes(job.props.state)) {
            return job;
        }

        const preparingJob = await this.setJobState(job.id, 'preparing', {
            startedAt: job.props.startedAt ?? new Date(),
            errorCode: null,
            errorMessage: null
        }, { publishUpdate: true });

        try {
            const copiedJob = await this.copyFrames(preparingJob);

            await this.trajectoryRepository.updateById(copiedJob.props.destinationTrajectoryId, {
                status: TrajectoryStatus.Completed,
                hasPreview: false,
                updatedAt: new Date()
            });

            const completedJob = await this.setJobState(copiedJob.id, 'completed', {
                finishedAt: new Date()
            }, { publishUpdate: true });

            logger.info(`[TrajectoryCloneCoordinator] Completed clone job=${completedJob.id} source=${completedJob.props.sourceTrajectoryId} destination=${completedJob.props.destinationTrajectoryId}`);
            return completedJob;
        } catch (error) {
            const errorCode = error instanceof ApplicationError ? error.code : 'TrajectoryClone::Failed';
            const errorMessage = error instanceof Error ? error.message : 'Trajectory clone failed';

            await this.trajectoryRepository.updateById(preparingJob.props.destinationTrajectoryId, {
                status: TrajectoryStatus.Failed,
                updatedAt: new Date()
            }).catch(() => undefined);

            const failedJob = await this.setJobState(preparingJob.id, 'failed', {
                finishedAt: new Date(),
                errorCode,
                errorMessage
            }, { publishUpdate: true });

            logger.error({ err: error }, `[TrajectoryCloneCoordinator] Failed clone job=${failedJob.id}`);
            return failedJob;
        }
    }

    private async copyFrames(initialJob: TrajectoryCloneJob): Promise<TrajectoryCloneJob> {
        const sourceTrajectory = await this.trajectoryRepository.findById(initialJob.props.sourceTrajectoryId);
        if (!sourceTrajectory) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Source trajectory not found');
        }

        const totalFrames = sourceTrajectory.props.frames?.length ?? 0;

        let currentJob = await this.setJobState(initialJob.id, 'copying', {
            stats: {
                ...initialJob.props.stats,
                totalFrames
            }
        }, { publishUpdate: true });

        if (totalFrames === 0) {
            return currentJob;
        }

        const sourceClusterId = initialJob.props.sourceClusterId ?? null;
        const destinationClusterId = initialJob.props.destinationClusterId;
        const sortedFrames = [...sourceTrajectory.props.frames].sort((a, b) => a.timestep - b.timestep);

        let pendingFrames = 0;
        let pendingBytes = 0;

        const flushProgress = async () => {
            if (pendingFrames === 0) {
                return;
            }

            currentJob = await this.setJobState(currentJob.id, 'copying', {
                stats: {
                    ...currentJob.props.stats,
                    copiedFrames: currentJob.props.stats.copiedFrames + pendingFrames,
                    copiedBytes: currentJob.props.stats.copiedBytes + pendingBytes
                }
            }, { publishUpdate: true });

            pendingFrames = 0;
            pendingBytes = 0;
        };

        for (const frame of sortedFrames) {
            const objectName = buildTrajectoryDumpObjectName(initialJob.props.sourceTrajectoryId, frame.timestep);
            const destinationObjectName = buildTrajectoryDumpObjectName(initialJob.props.destinationTrajectoryId, frame.timestep);

            const bytesTransferred = await this.copyDumpObject(
                sourceClusterId,
                destinationClusterId,
                objectName,
                destinationObjectName
            );

            pendingFrames += 1;
            pendingBytes += bytesTransferred;

            if (pendingFrames >= PROGRESS_FLUSH_EVERY_FRAMES) {
                await flushProgress();
            }
        }

        await flushProgress();
        return currentJob;
    }

    private async copyDumpObject(
        sourceClusterId: string | null,
        destinationClusterId: string,
        sourceObjectName: string,
        destinationObjectName: string
    ): Promise<number> {
        const sourceSnapshot = await this.readSourceObject(sourceClusterId, sourceObjectName);

        if (isLocalCluster(destinationClusterId)) {
            const uploadMetadata: Record<string, string> = { ...(sourceSnapshot.metadata ?? {}) };
            if (sourceSnapshot.contentType) {
                uploadMetadata['Content-Type'] = sourceSnapshot.contentType;
            }
            if (sourceSnapshot.contentEncoding) {
                uploadMetadata['Content-Encoding'] = sourceSnapshot.contentEncoding;
            }

            await this.storageService.upload(
                SYS_BUCKETS.DUMPS,
                destinationObjectName,
                sourceSnapshot.stream,
                uploadMetadata
            );

            return sourceSnapshot.contentLength ?? 0;
        }

        await this.objectGatewayClient.putStream(destinationClusterId, {
            bucket: SYS_BUCKETS.DUMPS,
            objectKey: destinationObjectName,
            stream: sourceSnapshot.stream,
            contentLength: sourceSnapshot.contentLength ?? 0,
            contentType: sourceSnapshot.contentType,
            contentEncoding: sourceSnapshot.contentEncoding,
            metadata: sourceSnapshot.metadata ?? {}
        });

        return sourceSnapshot.contentLength ?? 0;
    }

    private async readSourceObject(
        sourceClusterId: string | null,
        sourceObjectName: string
    ): Promise<{
        stream: Readable;
        contentLength?: number;
        contentType?: string;
        contentEncoding?: string;
        metadata?: Record<string, string>;
    }> {
        if (isLocalCluster(sourceClusterId)) {
            const [stat, stream] = await Promise.all([
                this.storageService.getStat(SYS_BUCKETS.DUMPS, sourceObjectName),
                this.storageService.getStream(SYS_BUCKETS.DUMPS, sourceObjectName)
            ]);
            return {
                stream,
                contentLength: stat.size,
                contentType: stat.mimetype || 'application/octet-stream'
            };
        }

        const response = await this.objectGatewayClient.getStream(
            sourceClusterId!,
            SYS_BUCKETS.DUMPS,
            sourceObjectName
        );
        return {
            stream: response.stream,
            contentLength: response.contentLength,
            contentType: response.contentType,
            contentEncoding: response.contentEncoding,
            metadata: response.metadata
        };
    }

    private async setJobState(
        jobId: string,
        state: TrajectoryCloneJobState,
        data: Partial<TrajectoryCloneJobProps> = {},
        options: { publishUpdate?: boolean } = {}
    ): Promise<TrajectoryCloneJob> {
        const updated = await this.cloneJobRepository.updateRuntimeState(jobId, {
            ...data,
            state,
            updatedAt: new Date()
        });

        if (!updated) {
            throw ApplicationError.notFound(
                'TrajectoryCloneJob::NotFound',
                'Trajectory clone job not found during update'
            );
        }

        if (options.publishUpdate) {
            await this.publishJobProjection(updated);
        }

        return updated;
    }

    async publishJobProjection(job: TrajectoryCloneJob): Promise<void> {
        try {
            const destinationTrajectory = await this.trajectoryRepository.findById(
                job.props.destinationTrajectoryId,
                { select: ['name'] }
            );

            await this.eventBus.publish(new JobStatusChangedEvent({
                jobId: job.id,
                teamId: job.props.team,
                status: mapCloneStateToJobStatus(job.props.state),
                queueType: TRAJECTORY_CLONE_QUEUE_TYPE,
                name: 'Trajectory Clone',
                message: getCloneJobMessage(job),
                trajectoryId: job.props.destinationTrajectoryId,
                trajectoryName: destinationTrajectory?.props.name || `Trajectory ${job.props.destinationTrajectoryId}`,
                source: 'projected',
                cleanupScope: 'trajectory-clone',
                cloneJobId: job.id,
                cloneState: job.props.state,
                sourceTrajectoryId: job.props.sourceTrajectoryId,
                destinationTrajectoryId: job.props.destinationTrajectoryId,
                sourceClusterId: job.props.sourceClusterId,
                destinationClusterId: job.props.destinationClusterId,
                totalFrames: job.props.stats.totalFrames,
                copiedFrames: job.props.stats.copiedFrames,
                copiedBytes: job.props.stats.copiedBytes,
                ...(job.props.errorMessage ? { error: job.props.errorMessage } : {})
            }));
        } catch (error) {
            logger.warn({ err: error }, `[TrajectoryCloneCoordinator] Failed to publish projection for job=${job.id}`);
        }
    }

    ensureDestinationPlacement(trajectoryId: string): Promise<void> {
        return this.storagePlacementService.ensurePlacement('trajectory', trajectoryId).then(() => undefined);
    }
}
