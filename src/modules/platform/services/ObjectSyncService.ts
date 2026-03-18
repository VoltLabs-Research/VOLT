import { ObjectBucketName, OrchestrationAction, PluginSyncRequest, TextEncoding, type ObjectUploadRequest, type RuntimeEventBroker } from '@/shared/contracts';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { logger } from '@/core/logger';
import type { MinioService } from './MinioService';

const emitProgress = (
    eventBroker: RuntimeEventBroker,
    action: OrchestrationAction,
    stage: ProgressStageType,
    payload?: Record<string, unknown>
): void => {
    eventBroker.emitProgress({
        action,
        stage,
        payload,
        timestamp: new Date().toISOString()
    });
};

export interface ObjectSyncService {
    uploadObject(input: ObjectUploadRequest): Promise<void>;
    syncPluginBinary(input: PluginSyncRequest): Promise<{ synced: boolean; objectKey: string; }>;
}

export const createObjectSyncService = (
    minioService: MinioService,
    eventBroker: RuntimeEventBroker
): ObjectSyncService => ({
    async uploadObject(input) {
        const encoding = input.encoding || TextEncoding.Utf8;
        const body = Buffer.from(input.content, encoding);
        await minioService.putObject({
            bucket: input.bucket,
            objectKey: input.objectKey,
            body,
            metadata: input.metadata
        });

        // Post-write verification for the legacy single-message upload path
        try {
            const stat = await minioService.statObject(input.bucket, input.objectKey);
            logger.info(
                {
                    objectKey: input.objectKey,
                    bucket: input.bucket,
                    uploadedSize: body.length,
                    minioReportedSize: stat.size,
                    sizeMatch: stat.size === body.length
                },
                'DIAG: Legacy upload post-write verification — object confirmed in MinIO'
            );
        } catch (verifyError) {
            logger.error(
                {
                    objectKey: input.objectKey,
                    bucket: input.bucket,
                    uploadedSize: body.length,
                    err: verifyError
                },
                'DIAG: Legacy upload post-write verification FAILED — object NOT found in MinIO after putObject succeeded'
            );
        }

        emitProgress(eventBroker, OrchestrationAction.ObjectUpload, ProgressStageType.Completed, {
            bucket: input.bucket,
            objectKey: input.objectKey
        });
    },

    async syncPluginBinary(input) {
        try {
            await minioService.statObject(ObjectBucketName.Plugins, input.objectKey);
        } catch {
            return {
                synced: false,
                objectKey: input.objectKey
            };
        }

        emitProgress(eventBroker, OrchestrationAction.PluginSync, ProgressStageType.Completed, {
            pluginId: input.pluginId,
            objectKey: input.objectKey
        });

        return {
            synced: true,
            objectKey: input.objectKey
        };
    }
});
