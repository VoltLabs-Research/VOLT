import { logger } from '@/core/logger';
import { ObjectBucketName, OrchestrationAction, type RuntimeEventBroker } from '@/shared/contracts';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import type { MinioService } from './MinioService';

interface ObjectUploadProgressPayload {
    bucket: ObjectBucketName;
    objectKey: string;
};

interface LegacyUploadVerificationInput {
    bucket: ObjectBucketName;
    objectKey: string;
    uploadedSize: number;
};

interface ChunkedUploadVerificationInput extends LegacyUploadVerificationInput {
    transferId: string;
};

export interface ObjectUploadLifecycleService {
    emitUploadCompleted(input: ObjectUploadProgressPayload): void;
    verifyLegacyUpload(input: LegacyUploadVerificationInput): Promise<void>;
    verifyChunkedUpload(input: ChunkedUploadVerificationInput): Promise<void>;
};

const removeObjectQuietly = async (
    minioService: MinioService,
    bucket: ObjectBucketName,
    objectKey: string
): Promise<void> => {
    await minioService.removeObject(bucket, objectKey).catch(() => {});
};

export const createObjectUploadLifecycleService = (
    minioService: MinioService,
    eventBroker: RuntimeEventBroker
): ObjectUploadLifecycleService => ({
    emitUploadCompleted(input) {
        eventBroker.emitProgress({
            action: OrchestrationAction.ObjectUpload,
            stage: ProgressStageType.Completed,
            payload: {
                bucket: input.bucket,
                objectKey: input.objectKey
            },
            timestamp: new Date().toISOString()
        });
    },

    async verifyLegacyUpload(input) {
        const stat = await minioService.statObject(input.bucket, input.objectKey).catch(async (verifyError) => {
            logger.error(
                {
                    objectKey: input.objectKey,
                    bucket: input.bucket,
                    uploadedSize: input.uploadedSize,
                    err: verifyError
                },
                'DIAG: Legacy upload post-write verification FAILED - object NOT found in MinIO after putObject succeeded'
            );
            await removeObjectQuietly(minioService, input.bucket, input.objectKey);
            throw verifyError;
        });

        logger.info(
            {
                objectKey: input.objectKey,
                bucket: input.bucket,
                uploadedSize: input.uploadedSize,
                minioReportedSize: stat.size,
                sizeMatch: stat.size === input.uploadedSize
            },
            'DIAG: Legacy upload post-write verification - object confirmed in MinIO'
        );

        if (stat.size !== input.uploadedSize) {
            logger.error(
                {
                    objectKey: input.objectKey,
                    bucket: input.bucket,
                    uploadedSize: input.uploadedSize,
                    minioReportedSize: stat.size
                },
                'DIAG: Legacy upload post-write size mismatch - MinIO object size differs from uploaded size'
            );
            await removeObjectQuietly(minioService, input.bucket, input.objectKey);
            throw new Error(`Uploaded object size mismatch for ${input.objectKey}`);
        }
    },

    async verifyChunkedUpload(input) {
        try {
            const stat = await minioService.statObject(input.bucket, input.objectKey);
            logger.info(
                {
                    transferId: input.transferId,
                    objectKey: input.objectKey,
                    bucket: input.bucket,
                    uploadedSize: input.uploadedSize,
                    minioReportedSize: stat.size,
                    sizeMatch: stat.size === input.uploadedSize
                },
                'DIAG: Post-write verification - object confirmed in MinIO'
            );

            if (stat.size !== input.uploadedSize) {
                logger.error(
                    {
                        transferId: input.transferId,
                        objectKey: input.objectKey,
                        bucket: input.bucket,
                        uploadedSize: input.uploadedSize,
                        minioReportedSize: stat.size
                    },
                    'DIAG: Post-write size mismatch - MinIO object size differs from uploaded size'
                );
                await removeObjectQuietly(minioService, input.bucket, input.objectKey);
                throw new Error(`Uploaded object size mismatch for ${input.objectKey}`);
            }
        } catch (verifyError) {
            logger.error(
                {
                    transferId: input.transferId,
                    objectKey: input.objectKey,
                    bucket: input.bucket,
                    uploadedSize: input.uploadedSize,
                    err: verifyError
                },
                'DIAG: Post-write verification failed after chunked upload'
            );
            await removeObjectQuietly(minioService, input.bucket, input.objectKey);
            throw verifyError;
        }
    }
});
