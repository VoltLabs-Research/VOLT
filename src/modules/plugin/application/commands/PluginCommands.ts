import { Command, CommandGroup } from '@/core/commands/decorators';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { isObjectNotFoundError } from '@/core/storage/contracts/cluster-object-store';
import {
    ObjectBucketName,
    type PluginSyncRequest,
    type PluginWarmupRequest,
    type PluginWarmupResponse,
    type TeamClusterDaemonPluginMongoExportPayload,
    type TeamClusterDaemonPluginMongoImportPayload,
    type TeamClusterDaemonPluginMongoPurgePayload
} from '@/contracts';
import type {
    PluginListingFilter,
    PluginListingRepository,
    PluginSubListingFilter
} from '@/modules/plugin/infrastructure/repositories/plugin-listing-repository-contract';
import ApplicationError from '@/app/coordination/ApplicationError';
import type { QueueService } from '@/core/queues/application/QueueService';
import { PLUGIN_WARMUP_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { PluginWarmupJobPayload } from '@/modules/plugin/application/binaries/PluginWarmupWorker';

@CommandGroup('plugin')
export class PluginCommands {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly pluginListingRepository: PluginListingRepository,
        private readonly queueService: QueueService
    ) {}

    @Command('sync')
    async sync(payload: PluginSyncRequest) {
        try {
            await this.objectStore.head(payload.ownerClusterId, ObjectBucketName.Plugins, payload.objectKey);
            return {
                synced: true,
                objectKey: payload.objectKey
            };
        } catch (error) {
            if (isObjectNotFoundError(error)) {
                return {
                    synced: false,
                    objectKey: payload.objectKey
                };
            }

            throw new ApplicationError(
                'Plugin::SyncUnavailable',
                `Failed to verify plugin binary availability for ${payload.objectKey}`,
                {
                    statusCode: 503,
                    cause: error
                }
            );
        }
    }

    @Command('warmup')
    async warmup(payload: PluginWarmupRequest): Promise<PluginWarmupResponse> {
        const jobId = `plugin-warmup:${payload.pluginId}:${payload.expectedHash ?? payload.binaryObjectPath}`;
        const warmupPayload: PluginWarmupJobPayload = {
            jobId,
            pluginId: payload.pluginId,
            binaryObjectPath: payload.binaryObjectPath,
            ownerClusterId: payload.ownerClusterId,
            requirementsFile: payload.requirementsFile,
            entrypointScript: payload.entrypointScript
        };
        const queued = await this.queueService.enqueue(PLUGIN_WARMUP_QUEUE_NAME, warmupPayload, {
            preserveExistingJob: true
        });
        return { queued, jobId };
    }

    @Command('listings.list')
    listListings(payload: PluginListingFilter) {
        return this.pluginListingRepository.listPluginListings(payload);
    }

    @Command('sub-listings.list')
    listSubListings(payload: PluginSubListingFilter) {
        return this.pluginListingRepository.listPluginSubListings(payload);
    }

    @Command('transfer.mongo.export')
    exportMongo(payload: TeamClusterDaemonPluginMongoExportPayload) {
        return this.pluginListingRepository.exportMongoRows(payload);
    }

    @Command('transfer.mongo.import')
    async importMongo(payload: TeamClusterDaemonPluginMongoImportPayload) {
        return {
            importedRows: await this.pluginListingRepository.importMongoRows(payload)
        };
    }

    @Command('transfer.mongo.purge')
    async purgeMongo(payload: TeamClusterDaemonPluginMongoPurgePayload) {
        return {
            deletedRows: await this.pluginListingRepository.purgeMongoRows(payload)
        };
    }
}
