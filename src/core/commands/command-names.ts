export const RuntimeCommands = Object.freeze({
    ConfigGet: 'runtime.config.get',
    RoleApply: 'runtime.role.apply',
    QueueConcurrencyApply: 'runtime.queue-concurrency.apply',
    Restart: 'runtime.restart',
    Uninstall: 'runtime.uninstall'
});

export const AnalysisCommands = Object.freeze({
    Start: 'analysis.start'
});

export const DebugCommands = Object.freeze({
    Start: 'debug.start',
    Step: 'debug.step',
    Continue: 'debug.continue',
    Stop: 'debug.stop'
});

export const ContainerCommands = Object.freeze({
    List: 'container.list',
    Create: 'container.create',
    Get: 'container.get',
    Update: 'container.update',
    Delete: 'container.delete',
    Stats: 'container.stats.get',
    ProcessesList: 'container.processes.list',
    FilesList: 'container.files.list',
    FileRead: 'container.file.read',
    FileWrite: 'container.file.write'
});

export const RemoteExplorerCommands = Object.freeze({
    List: 'remote.explorer.list',
    Node: 'remote.explorer.node',
    Download: 'remote.explorer.download'
});

export const JobsCommands = Object.freeze({
    List: 'jobs.list',
    Retry: 'jobs.retry',
    RemoveRunning: 'jobs.remove-running',
    ClearHistory: 'jobs.clear-history'
});

export const QueueCommands = Object.freeze({
    Dispatch: 'queue.dispatch'
});

export const NotebookCommands = Object.freeze({
    Delete: 'notebook.delete',
    RuntimeGet: 'notebook.runtime.get',
    SessionCreate: 'notebook.session.create'
});

export const PluginCommands = Object.freeze({
    Sync: 'plugin.sync',
    ListingsList: 'plugin.listings.list',
    SubListingsList: 'plugin.sub-listings.list',
    TransferMongoExport: 'plugin.transfer.mongo.export',
    TransferMongoImport: 'plugin.transfer.mongo.import',
    TransferMongoPurge: 'plugin.transfer.mongo.purge'
});

export const TrajectoryQueueCommands = Object.freeze({
    Rasterize: 'trajectory.rasterize',
    EnqueuePreprocessing: 'trajectory.enqueue-preprocessing'
});

export const TrajectoryNativeCommands = Object.freeze({
    Preprocess: 'trajectory.native.preprocess',
    Metadata: 'trajectory.native.metadata',
    PropertyStats: 'trajectory.native.property-stats',
    UniqueValues: 'trajectory.native.unique-values',
    AtomIds: 'trajectory.native.atom-ids',
    Atoms: 'trajectory.native.atoms',
    FilterPreview: 'trajectory.native.filter-preview',
    ColorModel: 'trajectory.native.color-model',
    ParticleFilterModel: 'trajectory.native.particle-filter-model'
});

export const TrajectoryPluginCommands = Object.freeze({
    PropertyNames: 'trajectory.plugin.property-names',
    ModifierAnalysis: 'trajectory.plugin.modifier-analysis',
    AtomIndex: 'trajectory.plugin.atom-index',
    ModifierValues: 'trajectory.plugin.modifier-values',
    ModifierStats: 'trajectory.plugin.modifier-stats',
    ModifierUniqueValues: 'trajectory.plugin.modifier-unique-values',
    AnalysisAllAtoms: 'trajectory.plugin.analysis-all-atoms'
});
