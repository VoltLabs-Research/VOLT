import type {
    TeamClusterEffectiveCapabilitiesProps,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRuntimeRoleConfigProps
} from '@shared/contracts/types/TeamCluster';

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
    AnalysisCleanupRuntimeState: 'analysis.cleanup-runtime-state',

    PipelineStart: 'pipeline.start',

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

    NotebookSessionCreate: 'notebook.session.create',

    PluginSync: 'plugin.sync',
    PluginWarmup: 'plugin.warmup',
    PluginRegistryInstall: 'plugin.registry.install',
    PluginListingsList: 'plugin.listings.list',
    PluginSubListingsList: 'plugin.sub-listings.list',
    PluginTransferListingsExport: 'plugin.transfer.listings.export',
    PluginTransferListingsImport: 'plugin.transfer.listings.import',
    PluginTransferListingsPurge: 'plugin.transfer.listings.purge',

    DebugStart: 'debug.start',
    DebugStep: 'debug.step',
    DebugContinue: 'debug.continue',
    DebugStop: 'debug.stop',

    RuntimeConfigGet: 'runtime.config.get',
    RuntimeRoleApply: 'runtime.role.apply',
    RuntimeQueueConcurrencyApply: 'runtime.queue-concurrency.apply',
    RuntimeQueuesSnapshot: 'runtime.queues.snapshot',
    RuntimeUninstall: 'runtime.uninstall',


    RemoteExplorerList: 'remote.explorer.list',
    RemoteExplorerNode: 'remote.explorer.node',
    RemoteExplorerDownload: 'remote.explorer.download',

    ObjectStoreArchiveCreate: 'object-store.archive.create',

    TrajectoryIngest: 'trajectory.ingest',
    TrajectoryClone: 'trajectory.clone',
    TrajectoryEnqueuePreprocessing: 'trajectory.enqueue-preprocessing',
    TrajectoryCleanupRuntimeState: 'trajectory.cleanup-runtime-state',
    TrajectoryNativeMetadata: 'trajectory.native.metadata',
    TrajectoryNativePropertyStats: 'trajectory.native.property-stats',
    TrajectoryNativeUniqueValues: 'trajectory.native.unique-values',
    TrajectoryNativeAtoms: 'trajectory.native.atoms',
    TrajectoryNativeFilterPreview: 'trajectory.native.filter-preview',
    TrajectoryNativeColorModel: 'trajectory.native.color-model',
    TrajectoryNativeParticleFilterModel: 'trajectory.native.particle-filter-model',

    TrajectoryPluginPropertyNames: 'trajectory.plugin.property-names',
    TrajectoryPluginPropertySchema: 'trajectory.plugin.property-schema',
    TrajectoryPluginAtomIndex: 'trajectory.plugin.atom-index',
    TrajectoryPluginModifierStats: 'trajectory.plugin.modifier-stats',
    TrajectoryPluginModifierUniqueValues: 'trajectory.plugin.modifier-unique-values'
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

export type PluginListingTransferKind = 'listing' | 'sub-listing';

export interface PluginListingTransferExportResult {
    rows: Record<string, unknown>[];
    total: number;
    hasMore: boolean;
    nextSkip: number;
}

export interface PluginListingTransferImportResult {
    importedRows: number;
}

export interface PluginListingTransferPurgeResult {
    deletedRows: number;
}

export interface TeamClusterDaemonRegistryInstallBinary {
    objectPath: string;
    fileName: string;
    hash: string;
    sizeBytes: number;
}

export interface TeamClusterDaemonRegistryInstallResult {
    workflow: unknown;
    binary: TeamClusterDaemonRegistryInstallBinary;
    ownerClusterId: string;
}
