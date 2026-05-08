import type {
    TeamClusterEffectiveCapabilitiesProps,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRuntimeRoleConfigProps
} from '@modules/cluster/domain/entities/TeamCluster';

export const TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH = '/internal/team-cluster/object-store/v1';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER = 'x-team-cluster-id';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER = 'x-team-cluster-daemon-password';
export const TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX = 'x-object-meta-';
export const TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER = 'x-volt-object-store-skip-metadata';
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

export const ChannelCommands = Object.freeze({
    AnalysisStart: 'analysis.start',

    ContainerList: 'container.list',
    ContainerCreate: 'container.create',
    ContainerGet: 'container.get',
    ContainerUpdate: 'container.update',
    ContainerDelete: 'container.delete',
    ContainerStats: 'container.stats.get',
    ContainerProcessesList: 'container.processes.list',
    ContainerFilesList: 'container.files.list',
    ContainerFileRead: 'container.file.read',

    JobsRetry: 'jobs.retry',
    JobsRemoveRunning: 'jobs.remove-running',

    NotebookDelete: 'notebook.delete',
    NotebookRuntimeGet: 'notebook.runtime.get',
    NotebookSessionCreate: 'notebook.session.create',

    PluginSync: 'plugin.sync',
    PluginWarmup: 'plugin.warmup',
    PluginListingsList: 'plugin.listings.list',
    PluginSubListingsList: 'plugin.sub-listings.list',
    PluginTransferMongoExport: 'plugin.transfer.mongo.export',
    PluginTransferMongoImport: 'plugin.transfer.mongo.import',
    PluginTransferMongoPurge: 'plugin.transfer.mongo.purge',

    DebugStart: 'debug.start',
    DebugStep: 'debug.step',
    DebugContinue: 'debug.continue',
    DebugStop: 'debug.stop',

    RuntimeConfigGet: 'runtime.config.get',
    RuntimeRoleApply: 'runtime.role.apply',
    RuntimeQueueConcurrencyApply: 'runtime.queue-concurrency.apply',
    RuntimeQueuesSnapshot: 'runtime.queues.snapshot',
    RuntimeUninstall: 'runtime.uninstall',

    QueueDispatch: 'queue.dispatch',

    RemoteExplorerList: 'remote.explorer.list',
    RemoteExplorerNode: 'remote.explorer.node',
    RemoteExplorerDownload: 'remote.explorer.download',

    TrajectoryRasterize: 'trajectory.rasterize',
    TrajectoryEnqueuePreprocessing: 'trajectory.enqueue-preprocessing',
    TrajectoryVtrIngest: 'trajectory.vtr.ingest',
    TrajectoryNativePreprocess: 'trajectory.native.preprocess',
    TrajectoryNativeMetadata: 'trajectory.native.metadata',
    TrajectoryNativePropertyStats: 'trajectory.native.property-stats',
    TrajectoryNativeUniqueValues: 'trajectory.native.unique-values',
    TrajectoryNativeAtomIds: 'trajectory.native.atom-ids',
    TrajectoryNativeAtoms: 'trajectory.native.atoms',
    TrajectoryNativeFilterPreview: 'trajectory.native.filter-preview',
    TrajectoryNativeColorModel: 'trajectory.native.color-model',
    TrajectoryNativeParticleFilterModel: 'trajectory.native.particle-filter-model',

    TrajectoryPluginPropertyNames: 'trajectory.plugin.property-names',
    TrajectoryPluginAtomIndex: 'trajectory.plugin.atom-index',
    TrajectoryPluginModifierValues: 'trajectory.plugin.modifier-values',
    TrajectoryPluginModifierStats: 'trajectory.plugin.modifier-stats',
    TrajectoryPluginModifierUniqueValues: 'trajectory.plugin.modifier-unique-values',
    TrajectoryPluginAnalysisAllAtoms: 'trajectory.plugin.analysis-all-atoms'
});

export interface TeamClusterDaemonQueueConcurrencyApplyPayload {
    [key: string]: unknown;
    queueConcurrency: TeamClusterQueueConcurrencyProps;
    queueScopeLimits: TeamClusterQueueScopeLimitsProps;
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

export interface TeamClusterDaemonPluginMongoExportResult {
    rows: Record<string, unknown>[];
    total: number;
    hasMore: boolean;
    nextSkip: number;
}

export interface TeamClusterDaemonPluginMongoImportResult {
    importedRows: number;
}

export interface TeamClusterDaemonPluginMongoPurgeResult {
    deletedRows: number;
}

export type StoragePlacementScopeType = 'trajectory' | 'analysis' | 'plugin-binary';
export type StoragePlacementState = 'active' | 'moving' | 'read-only' | 'deleting';

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
