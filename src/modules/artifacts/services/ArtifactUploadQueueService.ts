import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { DAEMON_PATHS } from '@/core/paths';
import { ARTIFACT_UPLOAD_QUEUE_NAME, QueueService } from '@/modules/platform/services';
import type { ReportArtifactInput } from '@/modules/cloud-control/services';

export interface ArtifactUploadBatchJobItem extends Record<string, unknown> {
    sourcePath: string;
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
    reportArtifact?: ReportArtifactInput;
}

export interface ArtifactUploadBatchJobPayload extends Record<string, unknown> {
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    batchDirectory: string;
    uploads: ArtifactUploadBatchJobItem[];
}

export interface ArtifactUploadBatchEnqueueResult {
    jobId?: string;
    queuedUploads: number;
}

interface ArtifactUploadStageInputBase {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
    reportArtifact?: ReportArtifactInput;
    fileName?: string;
}

export interface ArtifactUploadStageFileInput extends ArtifactUploadStageInputBase {
    sourcePath: string;
}

export interface ArtifactUploadStageBufferInput extends ArtifactUploadStageInputBase {
    buffer: Buffer;
}

export interface ArtifactUploadBatch {
    stageFileUpload(input: ArtifactUploadStageFileInput): Promise<void>;
    stageBufferUpload(input: ArtifactUploadStageBufferInput): Promise<void>;
    enqueue(): Promise<ArtifactUploadBatchEnqueueResult>;
    cleanup(): Promise<void>;
}

export interface ArtifactUploadQueueService {
    createBatch(context: {
        analysisId: string;
        analysisJobId: string;
        teamId: string;
        trajectoryId: string;
        trajectoryName?: string;
        timestep?: number;
    }): ArtifactUploadBatch;
}

const sanitizeFileName = (value: string): string => {
    const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-');
    return normalized.length > 0 ? normalized : 'artifact';
};

const resolveFileName = (input: ArtifactUploadStageInputBase, fallbackName: string): string => {
    if (typeof input.fileName === 'string' && input.fileName.trim().length > 0) {
        return sanitizeFileName(input.fileName);
    }

    const objectBaseName = path.basename(input.objectKey);
    if (objectBaseName.length > 0) {
        return sanitizeFileName(objectBaseName);
    }

    return sanitizeFileName(fallbackName);
};

const stageExistingFile = async (sourcePath: string, stagedPath: string): Promise<void> => {
    try {
        await fs.link(sourcePath, stagedPath);
        return;
    } catch (error) {
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError?.code !== 'EXDEV' && nodeError?.code !== 'EPERM' && nodeError?.code !== 'EEXIST') {
            throw error;
        }
    }

    await fs.copyFile(sourcePath, stagedPath);
};

export const createArtifactUploadQueueService = (
    queueService: QueueService
): ArtifactUploadQueueService => ({
    createBatch(context) {
        const batchDirectory = path.join(
            DAEMON_PATHS.artifactUploads,
            `${sanitizeFileName(context.analysisId)}-${sanitizeFileName(context.analysisJobId)}-${Date.now()}-${crypto.randomUUID()}`
        );
        const uploads: ArtifactUploadBatchJobItem[] = [];
        let nextSequence = 0;
        let enqueued = false;
        let directoryPrepared = false;

        const ensureBatchDirectory = async (): Promise<void> => {
            if (directoryPrepared) {
                return;
            }

            await fs.mkdir(batchDirectory, { recursive: true });
            directoryPrepared = true;
        };

        const assertMutable = (): void => {
            if (enqueued) {
                throw new Error(`Artifact upload batch for analysis ${context.analysisId} has already been enqueued`);
            }
        };

        const stageUpload = async (input: ArtifactUploadStageInputBase, writer: (stagedPath: string) => Promise<void>): Promise<void> => {
            assertMutable();
            await ensureBatchDirectory();

            const fileName = resolveFileName(input, `artifact-${nextSequence}`);
            const stagedPath = path.join(batchDirectory, `${String(nextSequence).padStart(4, '0')}-${fileName}`);
            nextSequence += 1;

            await writer(stagedPath);

            uploads.push({
                sourcePath: stagedPath,
                ownerClusterId: input.ownerClusterId,
                bucket: input.bucket,
                objectKey: input.objectKey,
                contentType: input.contentType,
                contentEncoding: input.contentEncoding,
                metadata: input.metadata,
                reportArtifact: input.reportArtifact
            });
        };

        return {
            async stageFileUpload(input) {
                await stageUpload(input, (stagedPath) => stageExistingFile(input.sourcePath, stagedPath));
            },

            async stageBufferUpload(input) {
                await stageUpload(input, (stagedPath) => fs.writeFile(stagedPath, input.buffer));
            },

            async enqueue() {
                assertMutable();

                if (uploads.length === 0) {
                    await this.cleanup();
                    enqueued = true;
                    return {
                        queuedUploads: 0
                    };
                }

                const payload: ArtifactUploadBatchJobPayload = {
                    jobId: `artifact-upload-${sanitizeFileName(context.analysisJobId)}`,
                    analysisId: context.analysisId,
                    teamId: context.teamId,
                    trajectoryId: context.trajectoryId,
                    trajectoryName: context.trajectoryName,
                    timestep: context.timestep,
                    batchDirectory,
                    uploads
                };

                await queueService.enqueue(ARTIFACT_UPLOAD_QUEUE_NAME, payload, {
                    preserveExistingJob: true,
                    attempts: 6,
                    backoff: {
                        type: 'exponential',
                        delay: 1_000
                    },
                    removeOnComplete: 1_000,
                    removeOnFail: false
                });

                enqueued = true;
                return {
                    jobId: payload.jobId,
                    queuedUploads: uploads.length
                };
            },

            async cleanup() {
                if (enqueued) {
                    return;
                }

                if (!directoryPrepared) {
                    return;
                }

                await fs.rm(batchDirectory, { recursive: true, force: true }).catch(() => {});
                directoryPrepared = false;
                uploads.length = 0;
                enqueued = true;
            }
        };
    }
});
