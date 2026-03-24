import type { PluginListingFilter, PluginListingRepository, PluginSubListingFilter } from '@/modules/artifacts';
import type { RuntimeEventBroker } from '@/shared/contracts';
import {
    ObjectBucketName,
    TEAM_CLUSTER_DAEMON_COMMAND,
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
    type PluginSyncRequest,
    type TeamClusterDaemonPluginMongoDocumentType,
    type TeamClusterDaemonPluginMongoExportPayload,
    type TeamClusterDaemonPluginMongoImportPayload,
    type TeamClusterDaemonPluginMongoPurgePayload
} from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import type { RuntimeCapabilityGuard } from '../services';
import { readNumber, readOptionalPayloadRecord, readOptionalString, readRecord, readString, readStringArray } from './payloadValidation';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

interface PluginHandlersDependencies {
    objectStore: ClusterObjectStore;
    eventBroker: RuntimeEventBroker;
    pluginListingRepository: PluginListingRepository;
    runtimeCapabilityGuard: RuntimeCapabilityGuard;
};

const readPluginSyncRequest = (payload: unknown): PluginSyncRequest => {
    const record = readOptionalPayloadRecord(payload);

    return {
        pluginId: readString(record.pluginId, 'pluginId'),
        objectKey: readString(record.objectKey, 'objectKey'),
        ...(typeof record.ownerClusterId === 'string'
            ? { ownerClusterId: readString(record.ownerClusterId, 'ownerClusterId') }
            : {}),
        ...(typeof record.expectedHash === 'string'
            ? { expectedHash: readString(record.expectedHash, 'expectedHash') }
            : {})
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

const readPluginMongoDocumentType = (value: unknown): TeamClusterDaemonPluginMongoDocumentType => {
    const documentType = readString(value, 'documentType');
    if (documentType !== 'listing' && documentType !== 'sub-listing') {
        throw new Error('documentType is invalid');
    }

    return documentType;
};

const readRecordArray = (value: unknown, fieldName: string): Record<string, unknown>[] => {
    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
    }

    return value.map((entry, index) => readRecord(entry, `${fieldName}[${index}]`));
};

const readPluginMongoExportRequest = (payload: unknown): TeamClusterDaemonPluginMongoExportPayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        analysisIds: readStringArray(record.analysisIds, 'analysisIds'),
        documentType: readPluginMongoDocumentType(record.documentType),
        skip: typeof record.skip === 'number' ? readNumber(record.skip, 'skip') : undefined,
        limit: typeof record.limit === 'number' ? readNumber(record.limit, 'limit') : undefined
    };
};

const readPluginMongoImportRequest = (payload: unknown): TeamClusterDaemonPluginMongoImportPayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        analysisIds: readStringArray(record.analysisIds, 'analysisIds'),
        documentType: readPluginMongoDocumentType(record.documentType),
        rows: readRecordArray(record.rows, 'rows')
    };
};

const readPluginMongoPurgeRequest = (payload: unknown): TeamClusterDaemonPluginMongoPurgePayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        analysisIds: readStringArray(record.analysisIds, 'analysisIds'),
        documentType: readPluginMongoDocumentType(record.documentType)
    };
};

export const createPluginHandlers = (deps: PluginHandlersDependencies): ReverseChannelCommandHandler[] => {
    return [
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.plugin.sync,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureAcceptsPluginWarmup(
                    TEAM_CLUSTER_DAEMON_COMMAND.plugin.sync
                );

                const request = readPluginSyncRequest(payload);
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
                data: await deps.pluginListingRepository.listPluginListings(readPluginListingFilter(payload))
            })
        },
        {
            command: 'plugin.sub-listings.list',
            execute: async (payload) => ({
                data: await deps.pluginListingRepository.listPluginSubListings(readPluginSubListingFilter(payload))
            })
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.plugin.transfer.mongo.export,
            execute: async (payload) => ({
                data: await deps.pluginListingRepository.exportMongoRows(readPluginMongoExportRequest(payload))
            })
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.plugin.transfer.mongo.import,
            execute: async (payload) => {
                const request = readPluginMongoImportRequest(payload);

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
                const request = readPluginMongoPurgeRequest(payload);

                return {
                    data: {
                        deletedRows: await deps.pluginListingRepository.purgeMongoRows(request)
                    }
                };
            }
        }
    ];
};
