import fs from 'node:fs/promises';
import path from 'node:path';
import { dir as createTempDir } from 'tmp-promise';

import { DAEMON_PATHS } from '@/core/paths';
import { ARTIFACT_UPLOAD_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { QueueService } from '@/core/queues/application/QueueService';
import type {
    ArtifactUploadBatch,
    ArtifactUploadBatchContext,
    ArtifactUploadBatchEnqueueResult,
    ArtifactUploadBatchJobPayload,
    ArtifactUploadBatchUpload,
    ArtifactUploadStageBufferInput,
    ArtifactUploadStageFileInput,
    ArtifactUploadStageInput
} from '@/modules/plugin/contracts/artifact-upload';

const sanitizeFileName = (value: string): string => {
    const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, '-');
    return sanitized.length > 0 ? sanitized : 'artifact';
};

const resolveFileName = (input: ArtifactUploadStageInput, fallbackName: string): string => {
    if (input.fileName) {
        return sanitizeFileName(input.fileName);
    }

    const objectBaseName = path.basename(input.objectKey);
    if (objectBaseName.length > 0) {
        return sanitizeFileName(objectBaseName);
    }

    return sanitizeFileName(fallbackName);
};

class DefaultArtifactUploadBatch implements ArtifactUploadBatch {
    private readonly uploads: ArtifactUploadBatchUpload[] = [];
    private nextSequence = 0;
    private enqueued = false;
    private batchDirectory: string | null = null;
    private batchDirectoryCleanup: (() => Promise<void>) | null = null;

    constructor(
        private readonly queueService: QueueService,
        private readonly context: ArtifactUploadBatchContext
    ) {}

    async stageFileUpload(input: ArtifactUploadStageFileInput): Promise<void> {
        await this.stageUpload(input, async (stagedPath) => {
            try {
                await fs.link(input.sourcePath, stagedPath);
                return;
            } catch (error) {
                const nodeError = error as NodeJS.ErrnoException;
                if (nodeError.code !== 'EXDEV' && nodeError.code !== 'EPERM' && nodeError.code !== 'EEXIST') {
                    throw error;
                }
            }

            await fs.copyFile(input.sourcePath, stagedPath);
        });
    }

    async stageBufferUpload(input: ArtifactUploadStageBufferInput): Promise<void> {
        await this.stageUpload(input, (stagedPath) => fs.writeFile(stagedPath, input.buffer));
    }

    async enqueue(): Promise<ArtifactUploadBatchEnqueueResult> {
        if (this.enqueued) {
            throw new Error(`Artifact upload batch for analysis ${this.context.analysisId} has already been enqueued`);
        }

        if (this.uploads.length === 0) {
            await this.cleanup();
            this.enqueued = true;
            return {
                queuedUploads: 0
            };
        }

        const payload: ArtifactUploadBatchJobPayload = {
            jobId: `artifact-upload-${sanitizeFileName(this.context.analysisJobId)}`,
            analysisId: this.context.analysisId,
            teamId: this.context.teamId,
            trajectoryId: this.context.trajectoryId,
            timestep: this.context.timestep,
            batchDirectory: this.batchDirectory as string,
            uploads: this.uploads
        };

        await this.queueService.enqueue(ARTIFACT_UPLOAD_QUEUE_NAME, payload, {
            preserveExistingJob: true,
            attempts: 6,
            backoff: {
                type: 'exponential',
                delay: 1_000
            },
            removeOnComplete: 1_000,
            removeOnFail: false
        });

        this.enqueued = true;
        return {
            jobId: payload.jobId,
            queuedUploads: this.uploads.length
        };
    }

    async cleanup(): Promise<void> {
        if (this.enqueued) {
            return;
        }

        if (!this.batchDirectoryCleanup) {
            return;
        }

        await this.batchDirectoryCleanup().catch(() => {});
        this.batchDirectory = null;
        this.batchDirectoryCleanup = null;
        this.uploads.length = 0;
        this.enqueued = true;
    }

    private async ensureBatchDirectory(): Promise<string> {
        if (this.batchDirectory) {
            return this.batchDirectory;
        }

        await fs.mkdir(DAEMON_PATHS.artifactUploads, { recursive: true });
        const tempDirectory = await createTempDir({
            tmpdir: DAEMON_PATHS.artifactUploads,
            prefix: `${sanitizeFileName(this.context.analysisId)}-${sanitizeFileName(this.context.analysisJobId)}-`,
            unsafeCleanup: true
        });
        this.batchDirectory = tempDirectory.path;
        this.batchDirectoryCleanup = tempDirectory.cleanup;
        return this.batchDirectory;
    }

    private async stageUpload(
        input: ArtifactUploadStageInput,
        writer: (stagedPath: string) => Promise<void>
    ): Promise<void> {
        if (this.enqueued) {
            throw new Error(`Artifact upload batch for analysis ${this.context.analysisId} has already been enqueued`);
        }

        const batchDirectoryPath = await this.ensureBatchDirectory();
        const fileName = resolveFileName(input, `artifact-${this.nextSequence}`);
        const stagedPath = path.join(batchDirectoryPath, `${`${this.nextSequence}`.padStart(4, '0')}-${fileName}`);
        this.nextSequence += 1;

        await writer(stagedPath);

        this.uploads.push({
            sourcePath: stagedPath,
            ownerClusterId: input.ownerClusterId,
            bucket: input.bucket,
            objectKey: input.objectKey,
            contentType: input.contentType,
            contentEncoding: input.contentEncoding,
            metadata: input.metadata,
            reportArtifact: input.reportArtifact
        });
    }
}

export class ArtifactUploadQueue {
    constructor(private readonly queueService: QueueService) {}

    createBatch(context: ArtifactUploadBatchContext): ArtifactUploadBatch {
        return new DefaultArtifactUploadBatch(this.queueService, context);
    }
}
