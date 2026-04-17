import fs from 'node:fs/promises';
import path from 'node:path';
import { dir as createTempDir } from 'tmp-promise';

import { DAEMON_PATHS } from '@/core/paths';
import { ARTIFACT_UPLOAD_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { QueueService } from '@/core/queues/application/QueueService';
import type { SceneArtifactUpsertBatchItem as ReportArtifactInput } from '@/modules/plugin/application/events/SceneArtifactUpsertBatchItem';

interface ArtifactUploadBatchContext {
    analysisId: string;
    analysisJobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
}

interface ArtifactUploadBatchJobItem {
    sourcePath: string;
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
    reportArtifact?: ReportArtifactInput;
}

export interface ArtifactUploadBatchJobPayload {
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
    createBatch(context: ArtifactUploadBatchContext): ArtifactUploadBatch;
}

const sanitizeFileName = (value: string): string => {
    const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, '-');
    return sanitized.length > 0 ? sanitized : 'artifact';
};

const resolveFileName = (input: ArtifactUploadStageInputBase, fallbackName: string): string => {
    if (input.fileName) {
        return sanitizeFileName(input.fileName);
    }

    const objectBaseName = path.basename(input.objectKey);
    if (objectBaseName.length > 0) {
        return sanitizeFileName(objectBaseName);
    }

    return sanitizeFileName(fallbackName);
};

export const createArtifactUploadQueueService = (
    queueService: QueueService
): ArtifactUploadQueueService => ({
    createBatch(context) {
        const uploads: ArtifactUploadBatchJobItem[] = [];
        let nextSequence = 0;
        let enqueued = false;
        let batchDirectory: string | null = null;
        let batchDirectoryCleanup: (() => Promise<void>) | null = null;

        const ensureBatchDirectory = async (): Promise<string> => {
            if (batchDirectory) {
                return batchDirectory;
            }

            await fs.mkdir(DAEMON_PATHS.artifactUploads, { recursive: true });
            const tempDirectory = await createTempDir({
                tmpdir: DAEMON_PATHS.artifactUploads,
                prefix: `${sanitizeFileName(context.analysisId)}-${sanitizeFileName(context.analysisJobId)}-`,
                unsafeCleanup: true
            });
            batchDirectory = tempDirectory.path;
            batchDirectoryCleanup = tempDirectory.cleanup;
            return batchDirectory;
        };

        const stageUpload = async (input: ArtifactUploadStageInputBase, writer: (stagedPath: string) => Promise<void>): Promise<void> => {
            if (enqueued) {
                throw new Error(`Artifact upload batch for analysis ${context.analysisId} has already been enqueued`);
            }

            const batchDirectoryPath = await ensureBatchDirectory();
            const fileName = resolveFileName(input, `artifact-${nextSequence}`);
            const stagedPath = path.join(batchDirectoryPath, `${`${nextSequence}`.padStart(4, '0')}-${fileName}`);
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
                await stageUpload(input, async (stagedPath) => {
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
            },

            async stageBufferUpload(input) {
                await stageUpload(input, (stagedPath) => fs.writeFile(stagedPath, input.buffer));
            },

            async enqueue() {
                if (enqueued) {
                    throw new Error(`Artifact upload batch for analysis ${context.analysisId} has already been enqueued`);
                }

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
                    batchDirectory: batchDirectory as string,
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

                if (!batchDirectoryCleanup) {
                    return;
                }

                await batchDirectoryCleanup().catch(() => {});
                batchDirectory = null;
                batchDirectoryCleanup = null;
                uploads.length = 0;
                enqueued = true;
            }
        };
    }
});
