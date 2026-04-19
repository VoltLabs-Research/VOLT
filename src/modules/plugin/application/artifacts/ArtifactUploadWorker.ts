import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { DelayedError, type Job } from 'bullmq';

import { logger } from '@/core/logger';
import { BaseWorker, type QueueScopeConstraint } from '@/core/queues/application/BaseWorker';
import { QueueService } from '@/core/queues/application/QueueService';
import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { ARTIFACT_UPLOAD_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import type { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import type { ArtifactUploadBatchJobPayload } from '@/modules/plugin/contracts/artifact-upload';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@/modules/plugin/contracts/reverse-channel-plugin';
import type { ArtifactUploadCompletedEventData } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadCompletedEvent';
import type { ArtifactUploadFailedEventData } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadFailedEvent';
import type { ArtifactUploadStartedEventData } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadStartedEvent';
import { readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';
import { compressFileWithZstd } from '@/support/serialization/storage-codec';

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

export class ArtifactUploadWorker extends BaseWorker<ArtifactUploadBatchJobPayload> {
    protected readonly queueName = ARTIFACT_UPLOAD_QUEUE_NAME;

    constructor(
        queueService: QueueService,
        redisConnection: RedisConnection,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly objectStore: ClusterObjectStore,
        private readonly daemonArtifactReporter: ArtifactUploadReporter,
        private readonly daemonJobReporter: ArtifactUploadStatusReporter
    ) {
        super({ queueService, redisConnection });
    }

    start(concurrency: number = DEFAULT_ARTIFACT_UPLOAD_CONCURRENCY): void {
        super.start(concurrency);
    }

    protected scopeConstraints(payload: ArtifactUploadBatchJobPayload): QueueScopeConstraint[] {
        const limits = this.queueScopeLimitsRegistry.getSnapshot().artifactUpload;
        return [
            { scope: 'trajectory', scopeId: payload.trajectoryId, limit: limits.maxRunningPerTrajectory },
            { scope: 'team', scopeId: payload.teamId, limit: limits.maxRunningPerTeam }
        ];
    }

    protected async process(payload: ArtifactUploadBatchJobPayload, bullJob: Job<ArtifactUploadBatchJobPayload>): Promise<void> {
        try {
            await this.daemonJobReporter.reportArtifactUploadStarted({
                jobId: payload.jobId,
                analysisId: payload.analysisId,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                timestep: payload.timestep
            });

            for (const [index, upload] of payload.uploads.entries()) {
                await this.uploadOne(upload);
                await bullJob.updateProgress(Math.round(((index + 1) / payload.uploads.length) * 100));
            }

            await this.daemonArtifactReporter.flushPendingArtifacts();
            await this.daemonJobReporter.reportArtifactUploadCompleted({
                jobId: payload.jobId,
                analysisId: payload.analysisId,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                timestep: payload.timestep
            });
            await this.cleanupBatchDirectory(payload.batchDirectory);
        } catch (error) {
            if (error instanceof DelayedError) {
                throw error;
            }

            const maxAttempts = typeof bullJob.opts.attempts === 'number' ? bullJob.opts.attempts : 1;
            if (bullJob.attemptsMade + 1 >= maxAttempts) {
                await this.daemonArtifactReporter.flushPendingArtifacts();
                await this.daemonJobReporter.reportArtifactUploadFailed({
                    jobId: payload.jobId,
                    analysisId: payload.analysisId,
                    teamId: payload.teamId,
                    trajectoryId: payload.trajectoryId,
                    timestep: payload.timestep,
                    error: error instanceof Error ? error.message : String(error)
                }).catch(() => {});
                await this.cleanupBatchDirectory(payload.batchDirectory);
            }

            throw error;
        }
    }

    private async uploadOne(upload: ArtifactUploadBatchJobPayload['uploads'][number]): Promise<void> {
        const compressed = this.shouldCompress(upload.contentType);
        const sourcePath = compressed ? `${upload.sourcePath}.zst` : upload.sourcePath;
        if (compressed) {
            await compressFileWithZstd(upload.sourcePath, sourcePath);
        }

        const objectKey = this.resolveObjectKey(upload.objectKey, upload.contentType, compressed);
        const contentEncoding = compressed ? 'zstd' : upload.contentEncoding;

        try {
            const stat = await fs.stat(sourcePath);
            await this.objectStore.putObjectStream({
                ownerClusterId: upload.ownerClusterId,
                bucket: upload.bucket,
                objectKey,
                stream: createReadStream(sourcePath),
                size: stat.size,
                metadata: {
                    ...(upload.contentType ? { 'Content-Type': upload.contentType } : {}),
                    ...(contentEncoding ? { 'Content-Encoding': contentEncoding } : {}),
                    ...upload.metadata
                }
            });

            if (upload.reportArtifact) {
                await this.daemonArtifactReporter.reportArtifact({
                    ...upload.reportArtifact,
                    objectName: objectKey,
                    metadata: {
                        ...upload.reportArtifact.metadata,
                        compressionCodec: contentEncoding === 'zstd' ? 'zstd' : undefined
                    }
                });
            }
        } finally {
            if (compressed) {
                await fs.rm(sourcePath, { force: true }).catch(() => {});
            }
        }
    }

    private async cleanupBatchDirectory(batchDirectory: string): Promise<void> {
        await fs.rm(batchDirectory, { recursive: true, force: true }).catch((error) => {
            logger.warn(`Failed to cleanup artifact upload batch directory ${batchDirectory}: ${error instanceof Error ? error.message : String(error)}`);
        });
    }

    private shouldCompress(contentType: string | undefined): boolean {
        return contentType === 'application/msgpack' || contentType === 'model/gltf-binary';
    }

    private resolveObjectKey(objectKey: string, contentType: string | undefined, compressed: boolean): string {
        if (!compressed) {
            return objectKey;
        }
        if (contentType === 'application/msgpack' && !objectKey.endsWith('.msgpack.zst')) {
            return `${objectKey}.zst`;
        }
        if (contentType === 'model/gltf-binary' && !objectKey.endsWith('.glb.zst')) {
            return `${objectKey}.zst`;
        }
        return objectKey;
    }
}
