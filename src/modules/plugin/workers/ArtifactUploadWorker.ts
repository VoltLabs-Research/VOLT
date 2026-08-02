import { singleton } from '@shared/application/utilities/singleton';
import { getQueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { getObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { getDaemonArtifactReporter } from '@modules/analysis/services/DaemonArtifactReporter';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { DelayedError, type Job } from 'bullmq';

import { BaseWorker } from '@shared/infrastructure/queues/BaseWorker';
import { createLifecycleStatusReporter } from '@shared/infrastructure/queues/create-status-reporter';
import { QueueService, getQueueService } from '@shared/infrastructure/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { withJobLifecycle } from '@shared/infrastructure/queues/with-job-lifecycle';
import { ARTIFACT_UPLOAD_QUEUE_NAME } from '@core/constants/queue-names';
import type { ClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { logAndSwallow } from '@shared/application/utilities/error-message';
import { safeRemovePath } from '@shared/infrastructure/utilities/safe-remove-path';
import type { ArtifactUploadBatchJobPayload } from '@shared/contracts/types/artifact-upload';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@shared/contracts/channel/reverse-channel-plugin';
import type { BaseArtifactUploadEventData } from '@modules/plugin/events/plugin-events';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { compressFileWithZstd } from '@shared/infrastructure/storage/storage-codec';
import { mapLimited } from '@shared/application/utilities/map-limited';
import { createAnalysisStageReporter } from '@modules/analysis/services/workflow/AnalysisStageReporter';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';

const DEFAULT_PER_JOB_UPLOAD_CONCURRENCY = 4;

interface ArtifactUploadReporter {
    flushPendingArtifacts(): Promise<void>;
    reportArtifact(input: ReportArtifactInput): Promise<void>;
}

const DEFAULT_ARTIFACT_UPLOAD_CONCURRENCY = readPositiveIntegerEnv('ARTIFACT_UPLOAD_CONCURRENCY') ?? 8;

export class ArtifactUploadWorker extends BaseWorker<ArtifactUploadBatchJobPayload> {
    protected readonly queueName = ARTIFACT_UPLOAD_QUEUE_NAME;
    protected readonly scopeKey: QueueScopeKey = 'artifactUpload';
    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<BaseArtifactUploadEventData>>;

    constructor(
        queueService: QueueService,
        queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly objectStore: ClusterObjectStore,
        private readonly daemonArtifactReporter: ArtifactUploadReporter,
        private readonly daemonJobReporter: DaemonJobReporter
    ) {
        super({
            queueService,
            scopeLimitsRegistry: queueScopeLimitsRegistry
        });
        this.buildStatusReporter = createLifecycleStatusReporter<BaseArtifactUploadEventData>(
            {
                started: daemonJobReporter.reportArtifactUploadStarted,
                completed: daemonJobReporter.reportArtifactUploadCompleted,
                failed: daemonJobReporter.reportArtifactUploadFailed
            },
            'artifact upload'
        );
    }

    start(concurrency: number = DEFAULT_ARTIFACT_UPLOAD_CONCURRENCY): void {
        super.start(concurrency);
    }

    protected async process(payload: ArtifactUploadBatchJobPayload, bullJob: Job<ArtifactUploadBatchJobPayload>): Promise<void> {
        const statusPayload: BaseArtifactUploadEventData = {
            jobId: payload.jobId,
            analysisId: payload.analysisId,
            teamId: payload.teamId,
            trajectoryId: payload.trajectoryId,
            timestep: payload.timestep
        };
        const maxAttempts = bullJob.opts.attempts ?? 1;
        const isFinalAttempt = () => bullJob.attemptsMade + 1 >= maxAttempts;
        const stageReporter = createAnalysisStageReporter(this.daemonJobReporter, {
            jobId: payload.analysisJobId,
            name: 'Artifact Upload',
            analysisId: payload.analysisId,
            teamId: payload.teamId,
            trajectoryId: payload.trajectoryId,
            timestep: payload.timestep
        });
        const stageKey = `${payload.jobId}:artifact-upload`;

        await withJobLifecycle(
            {
                reportStatus: (status, error) => {
                    this.buildStatusReporter(statusPayload)(status, error);
                    void stageReporter.report({
                        stageKey,
                        label: 'Upload artifacts',
                        stageType: 'artifact-upload',
                        stageStatus: status === 'started'
                            ? 'running'
                            : status === 'completed'
                                ? 'completed'
                                : 'failed',
                        detail: error
                    });
                },
                shouldReportTerminal: (err) => !(err instanceof DelayedError) && isFinalAttempt(),
                cleanup: async ({ error }) => {
                    if (error instanceof DelayedError) {
                        return;
                    }
                    if (error === null || isFinalAttempt()) {
                        await this.daemonArtifactReporter.flushPendingArtifacts().catch(
                            logAndSwallow('error',
                                {
                                    jobId: payload.jobId,
                                    trajectoryId: payload.trajectoryId
                                },
                                'Failed to flush pending artifacts')
                        );
                        await this.cleanupBatchDirectory(payload.batchDirectory);
                    }
                }
            },
            async () => {
                let completed = 0;
                const total = payload.uploads.length;

                await mapLimited(payload.uploads, DEFAULT_PER_JOB_UPLOAD_CONCURRENCY, async (upload) => {
                    await this.uploadOne(upload);
                    completed += 1;
                    await bullJob.updateProgress(Math.round((completed / total) * 100));
                });
            }
        );
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
                await safeRemovePath(sourcePath);
            }
        }
    }

    private async cleanupBatchDirectory(batchDirectory: string): Promise<void> {
        await safeRemovePath(batchDirectory, { recursive: true });
    }

    private shouldCompress(contentType: string | undefined): boolean {
        return contentType === 'model/gltf-binary';
    }

    private resolveObjectKey(objectKey: string, contentType: string | undefined, compressed: boolean): string {
        if (!compressed) {
            return objectKey;
        }
        if (contentType === 'model/gltf-binary' && !objectKey.endsWith('.glb.zst')) {
            return `${objectKey}.zst`;
        }
        return objectKey;
    }
}

export const getArtifactUploadWorker = singleton((): ArtifactUploadWorker => new ArtifactUploadWorker(getQueueService(), getQueueScopeLimitsRegistry(), getObjectStore(), getDaemonArtifactReporter(), getDaemonJobReporter()));
