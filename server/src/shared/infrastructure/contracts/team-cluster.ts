import type {
    TeamClusterQueueConcurrencyProps,
    TeamClusterServicesProps
} from '@modules/team-cluster/domain/entities/TeamCluster';

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
    object: Object.freeze({
        list: 'object.list',
        get: 'object.get',
        upload: 'object.upload',
        uploadInit: 'object.upload.init',
        uploadChunk: 'object.upload.chunk',
        uploadCommit: 'object.upload.commit',
        uploadAbort: 'object.upload.abort'
    }),
    plugin: Object.freeze({
        sync: 'plugin.sync'
    }),
    runtime: Object.freeze({
        config: Object.freeze({
            get: 'runtime.config.get'
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
