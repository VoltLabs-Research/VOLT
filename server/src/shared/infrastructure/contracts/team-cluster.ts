import type {
    TeamClusterEffectiveCapabilitiesProps,
    TeamClusterQueueConcurrencyProps,
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterServicesProps
} from '@modules/team-cluster/domain/entities/TeamCluster';
import type {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposurePublicAccess
} from '@modules/team-cluster/domain/contracts/TeamClusterServiceExposure';

export const TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION = 1;
export const TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH = '/internal/team-cluster/object-store/v1';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER = 'x-team-cluster-id';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER = 'x-team-cluster-daemon-password';
export const TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX = 'x-object-meta-';
export const TEAM_CLUSTER_DIRECT_ACCESS_BASE_PATH = '/internal/team-cluster/direct-access/v1';
export const TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER = 'x-team-cluster-direct-access-token';
export const VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID = '__volt_server__';

export const TEAM_CLUSTER_EVENT = Object.freeze({
    lifecycleUpdated: 'team-cluster.updated'
});

export const TEAM_CLUSTER_DAEMON_EVENT = Object.freeze({
    register: 'team-cluster-daemon:register',
    registered: 'team-cluster-daemon:registered',
    message: 'team-cluster-daemon:message'
});

export const TEAM_CLUSTER_DAEMON_COMMAND = Object.freeze({
    analysis: Object.freeze({
        start: 'analysis.start'
    }),
    container: Object.freeze({
        list: 'container.list',
        create: 'container.create',
        get: 'container.get',
        update: 'container.update',
        delete: 'container.delete',
        stats: Object.freeze({
            get: 'container.stats.get'
        }),
        processes: Object.freeze({
            list: 'container.processes.list'
        }),
        files: Object.freeze({
            list: 'container.files.list'
        }),
        file: Object.freeze({
            read: 'container.file.read',
            write: 'container.file.write'
        })
    }),
    jobs: Object.freeze({
        list: 'jobs.list',
        retry: 'jobs.retry',
        removeRunning: 'jobs.remove-running',
        clearHistory: 'jobs.clear-history'
    }),
    notebook: Object.freeze({
        delete: 'notebook.delete',
        runtime: Object.freeze({
            get: 'notebook.runtime.get'
        }),
        session: Object.freeze({
            create: 'notebook.session.create'
        })
    }),
    plugin: Object.freeze({
        sync: 'plugin.sync',
        transfer: Object.freeze({
            mongo: Object.freeze({
                export: 'plugin.transfer.mongo.export',
                import: 'plugin.transfer.mongo.import',
                purge: 'plugin.transfer.mongo.purge'
            })
        })
    }),
    runtime: Object.freeze({
        config: Object.freeze({
            get: 'runtime.config.get'
        }),
        role: Object.freeze({
            apply: 'runtime.role.apply'
        }),
        queueConcurrency: Object.freeze({
            apply: 'runtime.queue-concurrency.apply'
        }),
        restart: 'runtime.restart'
    }),
    queue: Object.freeze({
        dispatch: 'queue.dispatch'
    }),
    remoteExplorer: Object.freeze({
        list: 'remote.explorer.list',
        node: 'remote.explorer.node',
        download: 'remote.explorer.download'
    }),
    trajectory: Object.freeze({
        rasterize: 'trajectory.rasterize',
        enqueuePreprocessing: 'trajectory.enqueue-preprocessing',
        native: Object.freeze({
            preprocess: 'trajectory.native.preprocess',
            metadata: 'trajectory.native.metadata',
            propertyStats: 'trajectory.native.property-stats',
            uniqueValues: 'trajectory.native.unique-values',
            atomIds: 'trajectory.native.atom-ids',
            atoms: 'trajectory.native.atoms',
            filterPreview: 'trajectory.native.filter-preview',
            colorModel: 'trajectory.native.color-model',
            particleFilterModel: 'trajectory.native.particle-filter-model'
        })
    })
});

export const TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND = Object.freeze({
    list: TEAM_CLUSTER_DAEMON_COMMAND.remoteExplorer.list,
    node: TEAM_CLUSTER_DAEMON_COMMAND.remoteExplorer.node,
    download: TEAM_CLUSTER_DAEMON_COMMAND.remoteExplorer.download,
    List: TEAM_CLUSTER_DAEMON_COMMAND.remoteExplorer.list,
    Node: TEAM_CLUSTER_DAEMON_COMMAND.remoteExplorer.node,
    Download: TEAM_CLUSTER_DAEMON_COMMAND.remoteExplorer.download
});

export interface ResolvedTeamClusterDaemonConnection {
    teamClusterId: string;
};

export interface ResolvedTeamClusterRedisConnection {
    teamClusterId: string;
    host: string;
    port: number;
    username: string;
    password: string;
    db: number;
};

export interface ResolvedTeamClusterMinioConnection {
    teamClusterId: string;
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
};

export interface ResolvedTeamClusterServices {
    daemon: ResolvedTeamClusterDaemonConnection;
    redis: ResolvedTeamClusterRedisConnection;
    minio: ResolvedTeamClusterMinioConnection;
    services: TeamClusterServicesProps;
};

export interface TeamClusterDaemonQueueConcurrencyApplyPayload {
    [key: string]: unknown;
    queueConcurrency: TeamClusterQueueConcurrencyProps;
};

export interface TeamClusterRuntimeSnapshot {
    contractVersion: number;
    queueConcurrency: TeamClusterQueueConcurrencyProps;
    roleConfig: TeamClusterRuntimeRoleConfigProps;
    effectiveCapabilities: TeamClusterEffectiveCapabilitiesProps;
}

export interface TeamClusterDaemonRoleApplyPayload {
    [key: string]: unknown;
    roleConfig: TeamClusterRuntimeRoleConfigProps;
}

export interface TeamClusterDaemonRoleApplyResult {
    accepted: boolean;
    roleConfig: TeamClusterRuntimeRoleConfigProps;
    effectiveCapabilities: TeamClusterEffectiveCapabilitiesProps;
}

export type TeamClusterDaemonPluginMongoDocumentType = 'listing' | 'sub-listing';

export interface TeamClusterDaemonPluginMongoExportPayload {
    analysisIds: string[];
    documentType: TeamClusterDaemonPluginMongoDocumentType;
    skip?: number;
    limit?: number;
}

export interface TeamClusterDaemonPluginMongoExportResult {
    rows: Record<string, unknown>[];
    total: number;
    hasMore: boolean;
    nextSkip: number;
}

export interface TeamClusterDaemonPluginMongoImportPayload {
    analysisIds: string[];
    documentType: TeamClusterDaemonPluginMongoDocumentType;
    rows: Record<string, unknown>[];
}

export interface TeamClusterDaemonPluginMongoImportResult {
    importedRows: number;
}

export interface TeamClusterDaemonPluginMongoPurgePayload {
    analysisIds: string[];
    documentType: TeamClusterDaemonPluginMongoDocumentType;
}

export interface TeamClusterDaemonPluginMongoPurgeResult {
    deletedRows: number;
}

export type StoragePlacementScopeType = 'trajectory' | 'analysis' | 'plugin-binary';
export type StoragePlacementState = 'active' | 'moving' | 'read-only' | 'deleting';

export interface TeamClusterDirectAccessGrantRequest {
    ownerClusterId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export interface TeamClusterDirectAccessGrantResponse {
    ownerClusterId: string;
    exposureName: string;
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    endpoint: TeamClusterServiceExposurePublicAccess;
    token: string;
    expiresAt: string;
}

export interface StoragePlacementBucketRef {
    bucket: string;
    prefix: string;
}

export interface StoragePlacement {
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    primaryClusterId: string;
    replicaClusterIds: string[];
    buckets: StoragePlacementBucketRef[];
    state: StoragePlacementState;
    lastVerifiedAt?: Date | string;
    bytesUsed?: number;
}

export interface ResolvedObjectRef {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    expectedHash?: string;
    sizeBytes?: number;
}

export interface ResolvedObjectWrite {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    expectedHash?: string;
    sizeBytes?: number;
    contentType?: string;
}
