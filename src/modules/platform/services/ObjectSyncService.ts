import { createObjectUploadLifecycleService } from '@/modules/platform/services/ObjectUploadLifecycleService';
import { ObjectBucketName, OrchestrationAction, TextEncoding } from '@/shared/contracts';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import type { MinioService } from './MinioService';
import type { ObjectUploadRequest, PluginSyncRequest, RuntimeEventBroker } from '@/shared/contracts';

export interface ObjectSyncService {
    uploadObject(input: ObjectUploadRequest): Promise<void>;
    syncPluginBinary(input: PluginSyncRequest): Promise<{ synced: boolean; objectKey: string; }>;
};

export const createObjectSyncService = (
    minioService: MinioService,
    eventBroker: RuntimeEventBroker
): ObjectSyncService => {
    const objectUploadLifecycleService = createObjectUploadLifecycleService(minioService, eventBroker);

    return {
        async uploadObject(input) {
            const encoding = input.encoding || TextEncoding.Utf8;
            const body = Buffer.from(input.content, encoding);
            await minioService.putObject({
                bucket: input.bucket,
                objectKey: input.objectKey,
                body,
                metadata: input.metadata
            });

            await objectUploadLifecycleService.verifyLegacyUpload({
                bucket: input.bucket,
                objectKey: input.objectKey,
                uploadedSize: body.length
            });

            objectUploadLifecycleService.emitUploadCompleted({
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

            eventBroker.emitProgress({
                action: OrchestrationAction.PluginSync,
                stage: ProgressStageType.Completed,
                payload: {
                    pluginId: input.pluginId,
                    objectKey: input.objectKey
                },
                timestamp: new Date().toISOString()
            });

            return {
                synced: true,
                objectKey: input.objectKey
            };
        }
    };
};
