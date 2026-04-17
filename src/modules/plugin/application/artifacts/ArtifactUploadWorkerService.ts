import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

import { logger } from '@/core/logger';
import { ARTIFACT_UPLOAD_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { QueueService } from '@/core/queues/application/QueueService';
import { createMemoryAwareWorkerShell } from '@/core/queues/infrastructure/memory-aware-worker';
import { delayJobOnQueueScopeContention, tryAcquireQueueScopeLease } from '@/core/queues/infrastructure/queue-scope-lease';
import { DelayedError } from 'bullmq';
import type { MemoryAwareWorkerShell } from '@/core/queues/infrastructure/memory-aware-worker';
import type { QueueScopeLease } from '@/core/queues/infrastructure/queue-scope-lease';
import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import type { RedisConnectionService } from '@/core/storage/infrastructure/redis/RedisConnectionService';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@/modules/plugin/application/events/SceneArtifactUpsertBatchItem';
import { readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';
import { compressFileWithZstd } from '@/support/serialization/storage-codec';
import type { Job } from 'bullmq';

import type { ArtifactUploadBatchJobPayload } from '@/modules/plugin/application/artifacts/ArtifactUploadQueueService';
import type { ArtifactUploadCompletedEventData } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadCompletedEvent';
import type { ArtifactUploadFailedEventData } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadFailedEvent';
import type { ArtifactUploadStartedEventData } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadStartedEvent';

interface ArtifactUploadReporter {
    flushPendingArtifacts(): Promise<void>;
    reportArtifact(input: ReportArtifactInput): Promise<void>;
}

interface ArtifactUploadStatusReporter {
    reportArtifactUploadCompleted(input: ArtifactUploadCompletedEventData): Promise<void>;
    reportArtifactUploadFailed(input: ArtifactUploadFailedEventData): Promise<void>;
    reportArtifactUploadStarted(input: ArtifactUploadStartedEventData): Promise<void>;
}

const DEFAULT_ARTIFACT_UPLOAD_CONCURRENCY = readPositiveIntegerEnv('ARTIFACT_UPLOAD_CONCURRENCY') ?? 8;

export class ArtifactUploadWorkerService {
    private readonly workerShell: MemoryAwareWorkerShell<ArtifactUploadBatchJobPayload>;

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly objectStore: ClusterObjectStore,
        private readonly daemonArtifactReporterService: ArtifactUploadReporter,
        private readonly daemonJobReporterService: ArtifactUploadStatusReporter
    ) {
        this.workerShell = createMemoryAwareWorkerShell<ArtifactUploadBatchJobPayload>({
            queueService,
            queueName: ARTIFACT_UPLOAD_QUEUE_NAME,
            startedMessage: 'Artifact upload worker started',
            stoppedMessage: 'Artifact upload worker stopped',
            failedMessage: 'Artifact upload batch failed'
        });
    }

    start(concurrency = DEFAULT_ARTIFACT_UPLOAD_CONCURRENCY): void {
        this.workerShell.start(
            async (jobPayload, bullJob) => this.processBatch(jobPayload, bullJob),
            {
                concurrency,
                onFailed: async (job, error) => {
                    if (!job?.data) {
                        return;
                    }

                    const maxAttempts = typeof job.opts.attempts === 'number'
                        ? job.opts.attempts
                        : 1;

                    if (job.attemptsMade < maxAttempts) {
                        return;
                    }

                    logger.error(
                        {
                            analysisId: job.data.analysisId,
                            batchDirectory: job.data.batchDirectory,
                            err: error,
                            jobId: job.data.jobId,
                            uploads: job.data.uploads.length
                        },
                        'Artifact upload batch exhausted all retry attempts'
                    );
                }
            }
        );
    }

    async stop(): Promise<void> {
        await this.workerShell.stop();
    }

    private async processBatch(payload: ArtifactUploadBatchJobPayload, bullJob: Job<ArtifactUploadBatchJobPayload>): Promise<void> {
        let queueScopeLease: QueueScopeLease | null = null;

        try {
            const trajectoryId = payload.trajectoryId;
            if (!trajectoryId) {
                throw new Error(`Missing trajectoryId for artifact upload job ${payload.jobId}`);
            }

            const queueScopeLimits = this.queueScopeLimitsRegistry.getSnapshot();
            const { lease, blockingScope } = await tryAcquireQueueScopeLease(
                this.redisConnectionService,
                ARTIFACT_UPLOAD_QUEUE_NAME,
                [
                    {
                        scope: 'trajectory',
                        scopeId: trajectoryId,
                        limit: queueScopeLimits.artifactUpload.maxRunningPerTrajectory
                    },
                    {
                        scope: 'team',
                        scopeId: payload.teamId,
                        limit: queueScopeLimits.artifactUpload.maxRunningPerTeam
                    }
                ]
            );
            queueScopeLease = lease;
            if (blockingScope) {
                await delayJobOnQueueScopeContention(bullJob, {
                    queueName: ARTIFACT_UPLOAD_QUEUE_NAME,
                    jobId: payload.jobId,
                    scope: blockingScope
                });
            } else if (!queueScopeLease) {
                await delayJobOnQueueScopeContention(bullJob, {
                    queueName: ARTIFACT_UPLOAD_QUEUE_NAME,
                    jobId: payload.jobId,
                    scope: {
                        scope: 'trajectory',
                        scopeId: trajectoryId,
                        limit: queueScopeLimits.artifactUpload.maxRunningPerTrajectory
                    }
                });
            }

            await this.daemonJobReporterService.reportArtifactUploadStarted({
                jobId: payload.jobId,
                analysisId: payload.analysisId,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                trajectoryName: payload.trajectoryName,
                timestep: payload.timestep
            });

            logger.info(
                {
                    analysisId: payload.analysisId,
                    artifactCount: payload.uploads.length,
                    batchDirectory: payload.batchDirectory,
                    jobId: payload.jobId
                },
                'Processing staged artifact upload batch'
            );

            for (let index = 0; index < payload.uploads.length; index += 1) {
                const upload = payload.uploads[index]!;
                const shouldCompress = upload.contentType === 'application/msgpack' || upload.contentType === 'model/gltf-binary';
                const cleanupPath = shouldCompress ? `${upload.sourcePath}.zst` : undefined;
                if (cleanupPath) {
                    await compressFileWithZstd(upload.sourcePath, cleanupPath);
                }

                let objectKey = upload.objectKey;
                if (upload.contentType === 'application/msgpack' && !objectKey.endsWith('.msgpack.zst')) {
                    objectKey = `${objectKey}.zst`;
                }

                if (upload.contentType === 'model/gltf-binary' && !objectKey.endsWith('.glb.zst')) {
                    objectKey = `${objectKey}.zst`;
                }

                const preparedUpload = {
                    sourcePath: cleanupPath ?? upload.sourcePath,
                    objectKey,
                    contentEncoding: cleanupPath ? 'zstd' : upload.contentEncoding,
                    cleanupPath
                };

                try {
                    const fileStat = await fs.stat(preparedUpload.sourcePath);

                    await this.objectStore.putObjectStream({
                        ownerClusterId: upload.ownerClusterId,
                        bucket: upload.bucket,
                        objectKey: preparedUpload.objectKey,
                        stream: createReadStream(preparedUpload.sourcePath),
                        size: fileStat.size,
                        metadata: {
                            ...(upload.contentType ? { 'Content-Type': upload.contentType } : {}),
                            ...(preparedUpload.contentEncoding ? { 'Content-Encoding': preparedUpload.contentEncoding } : {}),
                            ...upload.metadata
                        }
                    });

                    if (upload.reportArtifact) {
                        await this.daemonArtifactReporterService.reportArtifact({
                            ...upload.reportArtifact,
                            objectName: preparedUpload.objectKey,
                            metadata: {
                                ...upload.reportArtifact.metadata,
                                compressionCodec: preparedUpload.contentEncoding === 'zstd' ? 'zstd' : undefined
                            }
                        });
                    }
                } finally {
                    if (preparedUpload.cleanupPath) {
                        await fs.rm(preparedUpload.cleanupPath, { force: true }).catch(() => {});
                    }
                }

                await bullJob.updateProgress(Math.round(((index + 1) / Math.max(1, payload.uploads.length)) * 100));
            }

            await this.daemonArtifactReporterService.flushPendingArtifacts();
            await this.daemonJobReporterService.reportArtifactUploadCompleted({
                jobId: payload.jobId,
                analysisId: payload.analysisId,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                trajectoryName: payload.trajectoryName,
                timestep: payload.timestep
            });
            await this.cleanupBatchDirectory(payload.batchDirectory);
        } catch (error) {
            if (error instanceof DelayedError) {
                throw error;
            }

            const maxAttempts = typeof bullJob.opts.attempts === 'number' ? bullJob.opts.attempts : 1;
            const willExhaustAttempts = bullJob.attemptsMade + 1 >= maxAttempts;

            if (willExhaustAttempts) {
                await this.daemonArtifactReporterService.flushPendingArtifacts();
                await this.daemonJobReporterService.reportArtifactUploadFailed({
                    jobId: payload.jobId,
                    analysisId: payload.analysisId,
                    teamId: payload.teamId,
                    trajectoryId: payload.trajectoryId,
                    trajectoryName: payload.trajectoryName,
                    timestep: payload.timestep,
                    error: error instanceof Error ? error.message : String(error)
                }).catch(() => {});

                await this.cleanupBatchDirectory(payload.batchDirectory);
            }

            throw error;
        } finally {
            if (queueScopeLease) {
                await queueScopeLease.release();
            }
        }
    }
    private async cleanupBatchDirectory(batchDirectory: string): Promise<void> {
        await fs.rm(batchDirectory, { recursive: true, force: true }).catch((error) => {
            logger.warn({ batchDirectory, err: error }, 'Failed to cleanup artifact upload batch directory');
        });
    }
}
