type ValueOf<T> = T[keyof T];

export type TeamClusterDaemonResponseType = ValueOf<typeof REVERSE_CHANNEL.ResponseType>;
export type TeamClusterDaemonSessionKind = ValueOf<typeof REVERSE_CHANNEL.SessionKind>;
export type TeamClusterDaemonTerminalTarget = ValueOf<typeof REVERSE_CHANNEL.TerminalTarget>;
export type TeamClusterTunnelSessionStatus = ValueOf<typeof REVERSE_CHANNEL.TunnelSessionStatus>;

export const REVERSE_CHANNEL = Object.freeze({
    ResponseType: Object.freeze({
        Json: 'json',
        Buffer: 'buffer',
        Stream: 'stream'
    }),
    SessionKind: Object.freeze({
        Terminal: 'terminal',
        Tunnel: 'tunnel',
        WebSocket: 'websocket'
    }),
    TerminalTarget: Object.freeze({
        Container: 'container'
    }),
    TunnelSessionStatus: Object.freeze({
        Opening: 'opening',
        Open: 'open',
        Closed: 'closed'
    })
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
    ContainerFileWrite: 'container.file.write',

    JobsList: 'jobs.list',
    JobsRetry: 'jobs.retry',
    JobsRemoveRunning: 'jobs.remove-running',
    JobsClearHistory: 'jobs.clear-history',

    NotebookDelete: 'notebook.delete',
    NotebookRuntimeGet: 'notebook.runtime.get',
    NotebookSessionCreate: 'notebook.session.create',

    PluginSync: 'plugin.sync',
    PluginTransferMongoExport: 'plugin.transfer.mongo.export',
    PluginTransferMongoImport: 'plugin.transfer.mongo.import',
    PluginTransferMongoPurge: 'plugin.transfer.mongo.purge',

    RuntimeConfigGet: 'runtime.config.get',
    RuntimeRoleApply: 'runtime.role.apply',
    RuntimeQueueConcurrencyApply: 'runtime.queue-concurrency.apply',
    RuntimeRestart: 'runtime.restart',

    QueueDispatch: 'queue.dispatch',

    RemoteExplorerList: 'remote.explorer.list',
    RemoteExplorerNode: 'remote.explorer.node',
    RemoteExplorerDownload: 'remote.explorer.download',

    TrajectoryRasterize: 'trajectory.rasterize',
    TrajectoryEnqueuePreprocessing: 'trajectory.enqueue-preprocessing',
    TrajectoryNativePreprocess: 'trajectory.native.preprocess',
    TrajectoryNativeMetadata: 'trajectory.native.metadata',
    TrajectoryNativePropertyStats: 'trajectory.native.property-stats',
    TrajectoryNativeUniqueValues: 'trajectory.native.unique-values',
    TrajectoryNativeAtomIds: 'trajectory.native.atom-ids',
    TrajectoryNativeAtoms: 'trajectory.native.atoms',
    TrajectoryNativeFilterPreview: 'trajectory.native.filter-preview',
    TrajectoryNativeColorModel: 'trajectory.native.color-model',
    TrajectoryNativeParticleFilterModel: 'trajectory.native.particle-filter-model'
});
