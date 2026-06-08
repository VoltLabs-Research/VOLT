import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { DelayedError, type Job } from 'bullmq';

import { Service } from '@/core/decorators/service';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import { QueueService } from '@/core/queues/application/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { ARTIFACT_UPLOAD_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { logAndSwallow } from '@/support/error/errorMessage';
import { safeRemovePath } from '@/support/fs/safe-remove-path';
import type { ArtifactUploadBatchJobPayload } from '@/modules/plugin/contracts/artifact-upload';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@/modules/plugin/contracts/reverse-channel-plugin';
import type {
    BaseArtifactUploadEventData,
    ArtifactUploadFailedEventData
} from '@/modules/plugin/domain/events';
import { readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';
import { compressFileWithZstd } from '@/support/serialization/storage-codec';
import { mapLimited } from '@/support/concurrency/map-limited';
import { createAnalysisStageReporter } from '@/modules/analysis/application/workflow/AnalysisStageReporter';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';

const DEFAULT_PER_JOB_UPLOAD_CONCURRENCY = 4;

interface ArtifactUploadReporter {
    flushPendingArtifacts(): Promise<void>;
    reportArtifact(input: ReportArtifactInput): Promise<void>;
}

interface ArtifactUploadStatusReporter {
    reportArtifactUploadCompleted(input: BaseArtifactUploadEventData): Promise<void>;
    reportArtifactUploadFailed(input: ArtifactUploadFailedEventData): Promise<void>;
    reportArtifactUploadStarted(input: BaseArtifactUploadEventData): Promise<void>;
    reportAnalysisStageStatus: DaemonJobReporter['reportAnalysisStageStatus'];
    reportAnalysisLogChunk: DaemonJobReporter['reportAnalysisLogChunk'];
}

const DEFAULT_ARTIFACT_UPLOAD_CONCURRENCY = readPositiveIntegerEnv('ARTIFACT_UPLOAD_CONCURRENCY') ?? 8;

@Service('artifactUploadWorker')
export class ArtifactUploadWorker extends BaseWorker<ArtifactUploadBatchJobPayload> {
    protected readonly queueName = ARTIFACT_UPLOAD_QUEUE_NAME;
    protected readonly scopeKey: QueueScopeKey = 'artifactUpload';
    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<BaseArtifactUploadEventData>>;

    constructor(
        queueService: QueueService,
        queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly objectStore: ClusterObjectStore,
        private readonly daemonArtifactReporter: ArtifactUploadReporter,
        private readonly daemonJobReporter: ArtifactUploadStatusReporter
    ) {
        super({ queueService, scopeLimitsRegistry: queueScopeLimitsRegistry });
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
                                { jobId: payload.jobId, trajectoryId: payload.trajectoryId },
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
