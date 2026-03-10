import { syncPluginBinary } from '../../core/runtimeActions';
import type { MinioService } from '../../infrastructure/minio/MinioService';
import type { RuntimeEventBroker } from '../../infrastructure/RuntimeEventBroker';
import type { PluginListingRepository } from '../../infrastructure/mongo/repositories/PluginListingRepository';
import type { ReverseChannelCommandHandler } from '../ReverseChannelSocketBridge';

interface PluginHandlersDependencies {
    minioService: MinioService;
    eventBroker: RuntimeEventBroker;
    pluginListingRepository: PluginListingRepository;
}

export const createPluginHandlers = (deps: PluginHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'plugin.sync',
        execute: async (payload) => ({
            data: await syncPluginBinary(payload as never, deps.minioService, deps.eventBroker)
        })
    },
    {
        command: 'plugin.listings.list',
        execute: async (payload) => ({
            data: await deps.pluginListingRepository.listPluginListings(payload as never)
        })
    },
    {
        command: 'plugin.sub-listings.list',
        execute: async (payload) => ({
            data: await deps.pluginListingRepository.listPluginSubListings(payload as never)
        })
    }
];
