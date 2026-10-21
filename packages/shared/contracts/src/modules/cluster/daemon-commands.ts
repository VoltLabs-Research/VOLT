// Every command sent over the daemon reverse channel. The server sends most of them to the
// daemon; RuntimeConfigGet and RuntimeLifecycle travel from the daemon to the server.
export const DaemonCommand = Object.freeze({
    AnalysisStart: 'analysis.start',
    AnalysisCleanupRuntimeState: 'analysis.cleanup-runtime-state',

    PipelineStart: 'pipeline.start',

    JobsRetry: 'jobs.retry',
    JobsRemoveRunning: 'jobs.remove-running',

    NotebookSessionCreate: 'notebook.session.create',
    NotebookContainerDelete: 'notebook.container.delete',

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
    RuntimeLifecycle: 'runtime.lifecycle',
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

export type DaemonCommand = typeof DaemonCommand[keyof typeof DaemonCommand];
