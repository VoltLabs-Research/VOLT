import { createObjectSyncService, type MinioService } from '../../platform/services';
import type { RuntimeEventBroker } from '../../../shared/contracts';
import type { PluginListingRepository } from '../../artifacts/repositories';
import type { ReverseChannelCommandHandler } from '../services';

interface PluginHandlersDependencies {
    minioService: MinioService;
    eventBroker: RuntimeEventBroker;
    pluginListingRepository: PluginListingRepository;
}

export const createPluginHandlers = (deps: PluginHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'plugin.sync',
        execute: async (payload) => ({
            data: await createObjectSyncService(deps.minioService, deps.eventBroker).syncPluginBinary(payload as never)
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
