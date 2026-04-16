import type { PluginListingFilter, PluginListingRepository, PluginSubListingFilter } from '@/modules/artifacts';
import {
    ObjectBucketName,
    TEAM_CLUSTER_DAEMON_COMMAND,
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
    type PluginSyncRequest,
    type TeamClusterDaemonPluginMongoExportPayload,
    type TeamClusterDaemonPluginMongoImportPayload,
    type TeamClusterDaemonPluginMongoPurgePayload
} from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import type { RuntimeCapabilityGuard } from '../services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

interface PluginHandlersDependencies {
    objectStore: ClusterObjectStore;
    pluginListingRepository: PluginListingRepository;
    runtimeCapabilityGuard: RuntimeCapabilityGuard;
};

export const createPluginHandlers = (deps: PluginHandlersDependencies): ReverseChannelCommandHandler[] => {
    return [
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.plugin.sync,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureAcceptsPluginWarmup(
                    TEAM_CLUSTER_DAEMON_COMMAND.plugin.sync
                );

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
            command: TEAM_CLUSTER_DAEMON_COMMAND.plugin.transfer.mongo.export,
            execute: async (payload) => ({
                data: await deps.pluginListingRepository.exportMongoRows(payload as TeamClusterDaemonPluginMongoExportPayload)
            })
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.plugin.transfer.mongo.import,
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
            command: TEAM_CLUSTER_DAEMON_COMMAND.plugin.transfer.mongo.purge,
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
