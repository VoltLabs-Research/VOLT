import { createObjectSyncService } from '@/modules/platform/services';
import type { PluginListingFilter, PluginListingRepository, PluginSubListingFilter } from '@/modules/artifacts';
import type { MinioService } from '@/modules/platform/services';
import type { PluginSyncRequest, RuntimeEventBroker } from '@/shared/contracts';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import { readNumber, readOptionalPayloadRecord, readOptionalString, readString } from './payloadValidation';

interface PluginHandlersDependencies {
    minioService: MinioService;
    eventBroker: RuntimeEventBroker;
    pluginListingRepository: PluginListingRepository;
};

const readPluginSyncRequest = (payload: unknown): PluginSyncRequest => {
    const record = readOptionalPayloadRecord(payload);

    return {
        pluginId: readString(record.pluginId, 'pluginId'),
        objectKey: readString(record.objectKey, 'objectKey')
    };
};

const readPluginListingFilter = (payload: unknown): PluginListingFilter => {
    const record = readOptionalPayloadRecord(payload);
    const filter: PluginListingFilter = {
        page: readNumber(record.page, 'page'),
        limit: readNumber(record.limit, 'limit')
    };

    if (typeof record.pluginId !== 'undefined') {
        filter.pluginId = readOptionalString(record.pluginId);
    }

    if (typeof record.trajectoryId !== 'undefined') {
        filter.trajectoryId = readOptionalString(record.trajectoryId);
    }

    if (typeof record.analysisId !== 'undefined') {
        filter.analysisId = readOptionalString(record.analysisId);
    }

    if (typeof record.exposureId !== 'undefined') {
        filter.exposureId = readOptionalString(record.exposureId);
    }

    if (typeof record.exposureName !== 'undefined') {
        filter.exposureName = readOptionalString(record.exposureName);
    }

    return filter;
};

const readPluginSubListingFilter = (payload: unknown): PluginSubListingFilter => {
    const record = readOptionalPayloadRecord(payload);
    const filter: PluginSubListingFilter = {
        page: readNumber(record.page, 'page'),
        limit: readNumber(record.limit, 'limit')
    };

    if (typeof record.analysisId !== 'undefined') {
        filter.analysisId = readOptionalString(record.analysisId);
    }

    if (typeof record.exposureId !== 'undefined') {
        filter.exposureId = readOptionalString(record.exposureId);
    }

    if (typeof record.timestep !== 'undefined') {
        filter.timestep = readNumber(record.timestep, 'timestep');
    }

    if (typeof record.subListingName !== 'undefined') {
        filter.subListingName = readOptionalString(record.subListingName);
    }

    return filter;
};

export const createPluginHandlers = (deps: PluginHandlersDependencies): ReverseChannelCommandHandler[] => {
    const objectSyncService = createObjectSyncService(deps.minioService, deps.eventBroker);

    return [
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.plugin.sync,
            execute: async (payload) => ({
                data: await objectSyncService.syncPluginBinary(readPluginSyncRequest(payload))
            })
        },
        {
            command: 'plugin.listings.list',
            execute: async (payload) => ({
                data: await deps.pluginListingRepository.listPluginListings(readPluginListingFilter(payload))
            })
        },
        {
            command: 'plugin.sub-listings.list',
            execute: async (payload) => ({
                data: await deps.pluginListingRepository.listPluginSubListings(readPluginSubListingFilter(payload))
            })
        }
    ];
};
