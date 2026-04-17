import type { ReverseChannelCommandHandler } from '@/core/reverse-channel/contracts/commandHandler';
import type {
    PluginListingFilter,
    PluginListingRepository,
    PluginSubListingFilter
} from '@/modules/plugin/infrastructure/repositories/PluginListingRepository.contract';
import type { RuntimeCapabilityGuard } from '@/core/runtime/application/RuntimeCapabilityGuard';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import {
    ChannelCommands,
    ObjectBucketName,
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
    type PluginSyncRequest,
    type TeamClusterDaemonPluginMongoExportPayload,
    type TeamClusterDaemonPluginMongoImportPayload,
    type TeamClusterDaemonPluginMongoPurgePayload
} from '@/contracts';

interface PluginHandlersDependencies {
    objectStore: ClusterObjectStore;
    pluginListingRepository: PluginListingRepository;
    runtimeCapabilityGuard: RuntimeCapabilityGuard;
}

export const createPluginHandlers = (deps: PluginHandlersDependencies): ReverseChannelCommandHandler[] => {
    return [
        {
            command: ChannelCommands.PluginSync,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureAcceptsPluginWarmup(ChannelCommands.PluginSync);

                const request = payload as PluginSyncRequest;
                const ownerClusterId = request.ownerClusterId || VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID;
                let synced = false;

                try {
                    await deps.objectStore.head(ownerClusterId, ObjectBucketName.Plugins, request.objectKey);
                    synced = true;
                } catch {
                    synced = false;
                }

                return {
                    data: {
                        synced,
                        objectKey: request.objectKey
                    }
                };
            }
        },
        {
            command: 'plugin.listings.list',
            execute: async (payload) => ({
                data: await deps.pluginListingRepository.listPluginListings(payload as PluginListingFilter)
            })
        },
        {
            command: 'plugin.sub-listings.list',
            execute: async (payload) => ({
                data: await deps.pluginListingRepository.listPluginSubListings(payload as PluginSubListingFilter)
            })
        },
        {
            command: ChannelCommands.PluginTransferMongoExport,
            execute: async (payload) => ({
                data: await deps.pluginListingRepository.exportMongoRows(payload as TeamClusterDaemonPluginMongoExportPayload)
            })
        },
        {
            command: ChannelCommands.PluginTransferMongoImport,
            execute: async (payload) => {
                const request = payload as TeamClusterDaemonPluginMongoImportPayload;

                return {
                    data: {
                        importedRows: await deps.pluginListingRepository.importMongoRows(request)
                    }
                };
            }
        },
        {
            command: ChannelCommands.PluginTransferMongoPurge,
            execute: async (payload) => {
                const request = payload as TeamClusterDaemonPluginMongoPurgePayload;

                return {
                    data: {
                        deletedRows: await deps.pluginListingRepository.purgeMongoRows(request)
                    }
                };
            }
        }
    ];
};
