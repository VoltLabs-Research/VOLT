import { Command, CommandGroup } from '@/core/commands/decorators';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import {
    ObjectBucketName,
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
    type PluginSyncRequest,
    type TeamClusterDaemonPluginMongoExportPayload,
    type TeamClusterDaemonPluginMongoImportPayload,
    type TeamClusterDaemonPluginMongoPurgePayload
} from '@/contracts';
import type {
    PluginListingFilter,
    PluginListingRepository,
    PluginSubListingFilter
} from '@/modules/plugin/infrastructure/repositories/plugin-listing-repository-contract';

@CommandGroup('plugin')
export class PluginCommands {
    constructor(
        private readonly objectStore: ClusterObjectStore,
        private readonly pluginListingRepository: PluginListingRepository
    ) {}

    @Command('sync')
    async sync(payload: PluginSyncRequest) {
        const ownerClusterId = payload.ownerClusterId || VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID;

        try {
            await this.objectStore.head(ownerClusterId, ObjectBucketName.Plugins, payload.objectKey);
            return {
                synced: true,
                objectKey: payload.objectKey
            };
        } catch {
            return {
                synced: false,
                objectKey: payload.objectKey
            };
        }
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
