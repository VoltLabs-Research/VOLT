import { singleton } from '@shared/utilities/singleton';
import type { WorkerBinding } from '@shared/queues/worker-registry';
import { getQueueScopeLimitsRegistry } from '@shared/queues/QueueScopeLimitsRegistry';
import { getObjectStore } from '@shared/storage/ClusterObjectStore';
import { getDaemonArtifactReporter } from '@modules/analysis/services/DaemonArtifactReporter';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { DeferJobError } from '@shared/queues/queue-job-handle';
import { throwIfAborted } from '@shared/queues/job-cancellation';
import type { QueueJobHandle } from '@shared/queues/queue-job-handle';

import { BaseWorker } from '@shared/queues/BaseWorker';
import { createLifecycleStatusReporter } from '@shared/queues/create-status-reporter';
import { QueueService, getQueueService } from '@shared/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/queues/QueueScopeLimitsRegistry';
import { withJobLifecycle } from '@shared/queues/with-job-lifecycle';
import { ARTIFACT_UPLOAD_QUEUE_NAME } from '@core/constants/queue-names';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { logAndSwallow } from '@shared/utilities/error-message';
import { safeRemovePath } from '@shared/utilities/safe-remove-path';
import type { ArtifactUploadBatchJobPayload } from '@shared/contracts/types/artifact-upload';
import type { BaseArtifactUploadEventData } from '@modules/plugin/events/plugin-events';
import { readPositiveIntegerEnv } from '@shared/utilities/env';
import { compressModel, MODEL_CONTENT_TYPE, MODEL_OBJECT_METADATA, toModelFormat, toModelObjectKey } from '@shared/storage/model-objects';
import { mapLimited } from '@shared/utilities/map-limited';
import { createAnalysisStageReporter } from '@modules/analysis/services/workflow/AnalysisStageReporter';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import type { SceneArtifactUpsertItem } from '@volt/contracts/modules/cluster/daemon-events';

const DEFAULT_PER_JOB_UPLOAD_CONCURRENCY = 4;

interface ArtifactUploadReporter {
    flushPendingArtifacts(): Promise<void>;
    reportArtifact(input: SceneArtifactUpsertItem): Promise<void>;
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

    protected async process(payload: ArtifactUploadBatchJobPayload, job: QueueJobHandle<ArtifactUploadBatchJobPayload>): Promise<void> {
        const statusPayload: BaseArtifactUploadEventData = {
            jobId: payload.jobId,
            analysisId: payload.analysisId,
            teamId: payload.teamId,
            trajectoryId: payload.trajectoryId,
            timestep: payload.timestep
        };
        const maxAttempts = job.opts.attempts ?? 1;
        const isFinalAttempt = () => job.attemptsMade + 1 >= maxAttempts;
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
                shouldReportTerminal: (err) => !(err instanceof DeferJobError) && isFinalAttempt(),
                cleanup: async ({ error }) => {
                    if (error instanceof DeferJobError) {
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
                await mapLimited(payload.uploads, DEFAULT_PER_JOB_UPLOAD_CONCURRENCY, (upload) =>
                    this.uploadOne(upload, job.signal));
            }
        );
    }

    private async uploadOne(upload: ArtifactUploadBatchJobPayload['uploads'][number], signal: AbortSignal): Promise<void> {
        throwIfAborted(signal);
        const objectKey = upload.contentType === MODEL_CONTENT_TYPE
            ? await this.uploadModel(upload)
            : await this.uploadFile(upload);

        if (upload.reportArtifact) {
            await this.daemonArtifactReporter.reportArtifact({
                ...upload.reportArtifact,
                objectName: objectKey
            });
        }
    }

    // Models go through the one model format (plugins and older SDKs may write plain glTF).
    private async uploadModel(upload: ArtifactUploadBatchJobPayload['uploads'][number]): Promise<string> {
        const objectKey = toModelObjectKey(upload.objectKey);
        const glb = toModelFormat(await fs.readFile(upload.sourcePath));
        await this.objectStore.putObject({
            ownerClusterId: upload.ownerClusterId,
            bucket: upload.bucket,
            objectKey,
            body: await compressModel(glb),
            metadata: {
                ...upload.metadata,
                ...MODEL_OBJECT_METADATA
            }
        });
        return objectKey;
    }

    private async uploadFile(upload: ArtifactUploadBatchJobPayload['uploads'][number]): Promise<string> {
        const stat = await fs.stat(upload.sourcePath);
        await this.objectStore.putObjectStream({
            ownerClusterId: upload.ownerClusterId,
            bucket: upload.bucket,
            objectKey: upload.objectKey,
            stream: createReadStream(upload.sourcePath),
            size: stat.size,
            metadata: {
                ...(upload.contentType ? { 'Content-Type': upload.contentType } : {}),
                ...(upload.contentEncoding ? { 'Content-Encoding': upload.contentEncoding } : {}),
                ...upload.metadata
            }
        });
        return upload.objectKey;
    }

    private async cleanupBatchDirectory(batchDirectory: string): Promise<void> {
        await safeRemovePath(batchDirectory, { recursive: true });
    }
}

export const artifactUploadWorker: WorkerBinding = {
    name: 'artifact-upload',
    scope: 'compute',
    concurrencyKey: 'artifactUpload',
    tracksConcurrencyWhileRunning: true,
    resolve: singleton((): ArtifactUploadWorker => new ArtifactUploadWorker(getQueueService(), getQueueScopeLimitsRegistry(), getObjectStore(), getDaemonArtifactReporter(), getDaemonJobReporter()))
};
