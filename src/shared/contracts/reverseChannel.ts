import {
    TeamClusterServiceExposureAccessMode,
    type TeamClusterServiceExposure
} from './serviceExposure';
import type {
    TeamClusterDaemonRoleApplyPayload,
    TeamClusterDaemonRoleApplyResult,
    TeamClusterEffectiveCapabilities,
    TeamClusterRuntimeRoleConfig
} from './teamClusterRuntime';
import type { RuntimeProgressEvent } from '@voltstack/daemon-cluster-client';

type ValueOf<T> = T[keyof T];

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
        Container: 'container',
        Host: 'host'
    }),
    TunnelSessionStatus: Object.freeze({
        Opening: 'opening',
        Open: 'open',
        Closed: 'closed'
    })
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

export type TeamClusterDaemonResponseType = ValueOf<typeof REVERSE_CHANNEL.ResponseType>;
export type TeamClusterDaemonSessionKind = ValueOf<typeof REVERSE_CHANNEL.SessionKind>;
export type TeamClusterDaemonTerminalTarget = ValueOf<typeof REVERSE_CHANNEL.TerminalTarget>;
export type TeamClusterTunnelSessionStatus = ValueOf<typeof REVERSE_CHANNEL.TunnelSessionStatus>;

export interface TeamClusterDaemonSocketHeaders {
    [key: string]: string;
};

export interface TeamClusterDaemonRegisterPayload {
    teamClusterId: string;
    daemonPassword: string;
};

export interface TeamClusterDaemonCommandMessage {
    type: 'command';
    requestId: string;
    command: string;
    responseType?: TeamClusterDaemonResponseType;
    payload?: Record<string, unknown>;
};

export interface TeamClusterDaemonQueueConcurrency {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
};

export interface TeamClusterDaemonQueueConcurrencyApplyPayload {
    [key: string]: unknown;
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
};

export interface TeamClusterDaemonRuntimeConfig {
    contractVersion: number;
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
    roleConfig: TeamClusterRuntimeRoleConfig;
    effectiveCapabilities: TeamClusterEffectiveCapabilities;
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

export type {
    TeamClusterDaemonRoleApplyPayload,
    TeamClusterDaemonRoleApplyResult,
    TeamClusterEffectiveCapabilities,
    TeamClusterRuntimeRoleConfig
};

export interface TeamClusterDaemonSocketResponsePayload<T = unknown> {
    type: 'response';
    requestId: string;
    ok: boolean;
    status: number;
    data?: T;
    bodyBase64?: string;
    headers?: TeamClusterDaemonSocketHeaders;
    message?: string;
    streamId?: string;
};

export interface TeamClusterDaemonSocketStreamPayload {
    type: 'stream';
    requestId: string;
    streamId: string;
    chunkBase64: string;
};

export interface TeamClusterDaemonSocketStreamStatePayload {
    type: 'stream-end';
    requestId: string;
    streamId: string;
    message?: string;
};

export interface TeamClusterDaemonSessionAttachPayload {
    sessionId: string;
    kind: TeamClusterDaemonSessionKind;
    terminalTarget?: TeamClusterDaemonTerminalTarget;
    containerId?: string;
    targetUrl?: string;
    protocols?: string[];
};

export interface TeamClusterDaemonSessionInputPayload {
    type: 'session-input';
    sessionId: string;
    chunkBase64: string;
    isBinary: boolean;
};

export interface TeamClusterDaemonSessionResizePayload {
    type: 'session-resize';
    sessionId: string;
    rows: number;
    cols: number;
};

export interface TeamClusterDaemonSessionDetachPayload {
    type: 'session-detach';
    sessionId: string;
};

export interface TeamClusterDaemonSessionDataPayload {
    type: 'session-data';
    sessionId: string;
    chunkBase64: string;
    isBinary: boolean;
};

export interface TeamClusterDaemonSessionEndPayload {
    type: 'session-end';
    sessionId: string;
    code?: number;
    message?: string;
    error?: string;
};

/**
 * Replaces the full exposure registry stored in volt/server for a connected team cluster.
 */
export interface TeamClusterDaemonExposureSnapshotPayload {
    type: 'exposure-snapshot';
    exposures: TeamClusterServiceExposure[];
};

/**
 * Applies additive exposure changes without replacing the full registry.
 */
export interface TeamClusterDaemonExposureUpsertPayload {
    type: 'exposure-upsert';
    exposures: TeamClusterServiceExposure[];
};

/**
 * Removes exposures that are no longer published by the daemon.
 */
export interface TeamClusterDaemonExposureRemovePayload {
    type: 'exposure-remove';
    exposureIds: string[];
};

export interface TeamClusterDaemonTunnelOpenBasePayload {
    type: 'tunnel-open';
    sessionId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    relay?: TeamClusterDaemonBinaryRelayDescriptor;
};

export interface TeamClusterDaemonBinaryRelayDescriptor {
    relaySessionId: string;
    relayUrl: string;
    relayToken: string;
    relayProtocolVersion: 1;
};

export interface TeamClusterDaemonExposureTunnelOpenPayload extends TeamClusterDaemonTunnelOpenBasePayload {
    exposureId: string;
};

export interface TeamClusterDaemonDirectTunnelOpenPayload extends TeamClusterDaemonTunnelOpenBasePayload {
    targetHost: string;
    targetPort: number;
};

/**
 * Opens a generic tunnel session against either a persistent exposure or a direct target.
 */
export type TeamClusterDaemonTunnelOpenPayload =
    | TeamClusterDaemonExposureTunnelOpenPayload
    | TeamClusterDaemonDirectTunnelOpenPayload;

/**
 * Acknowledges the final state of a tunnel session transition.
 */
export interface TeamClusterDaemonTunnelStatePayload {
    type: 'tunnel-state';
    sessionId: string;
    status: TeamClusterTunnelSessionStatus;
    message?: string;
    error?: string;
};

/**
 * Carries raw tunnel bytes for HTTP, WebSocket or arbitrary TCP sessions.
 */
export interface TeamClusterDaemonTunnelDataPayload {
    type: 'tunnel-data';
    sessionId: string;
    chunkBase64: string;
    isBinary: boolean;
};

/**
 * Closes a generic tunnel session on either side of the reverse channel.
 */
export interface TeamClusterDaemonTunnelClosePayload {
    type: 'tunnel-close';
    sessionId: string;
    code?: number;
    message?: string;
};

/**
 * Keeps long-lived tunnel sessions observable without transferring business data.
 */
export interface TeamClusterDaemonTunnelHeartbeatPayload {
    type: 'tunnel-heartbeat';
    sessionId: string;
    occurredAt: string;
};

export interface TeamClusterDaemonRuntimeProgressPayload extends Pick<
    RuntimeProgressEvent,
    'action' | 'stage' | 'timestamp' | 'payload'
> {
    type: 'runtime-progress';
};

export interface TeamClusterDaemonAnalysisJobCompletionEventPayload {
    type: 'analysis-job-completion';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    success: boolean;
    error?: string;
};

export interface TeamClusterDaemonAnalysisJobStatusEventPayload {
    type: 'analysis-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonRasterJobStatusEventPayload {
    type: 'trajectory-raster-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonGlbJobStatusEventPayload {
    type: 'trajectory-glb-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonSshImportJobStatusEventPayload {
    type: 'ssh-import-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonArtifactUploadJobStatusEventPayload {
    type: 'artifact-upload-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonSceneArtifactUpsertBatchItem {
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: 'color-coding' | 'particle-filter' | 'plugin-exposure';
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: Record<string, unknown>;
    displayName: string;
    status: 'ready' | 'failed';
    metadata?: Record<string, unknown>;
};

export interface TeamClusterDaemonSceneArtifactUpsertBatchEventPayload {
    type: 'trajectory-scene-artifact-upsert-batch';
    teamClusterId: string;
    daemonPassword: string;
    items: TeamClusterDaemonSceneArtifactUpsertBatchItem[];
};

export type TeamClusterDaemonServerEventMessage =
    | TeamClusterDaemonAnalysisJobCompletionEventPayload
    | TeamClusterDaemonAnalysisJobStatusEventPayload
    | TeamClusterDaemonRasterJobStatusEventPayload
    | TeamClusterDaemonGlbJobStatusEventPayload
    | TeamClusterDaemonSshImportJobStatusEventPayload
    | TeamClusterDaemonArtifactUploadJobStatusEventPayload
    | TeamClusterDaemonSceneArtifactUpsertBatchEventPayload;

export type TeamClusterDaemonMessage =
    | TeamClusterDaemonCommandMessage
    | TeamClusterDaemonSocketResponsePayload
    | TeamClusterDaemonSocketStreamPayload
    | TeamClusterDaemonSocketStreamStatePayload
    | TeamClusterDaemonSessionInputPayload
    | TeamClusterDaemonSessionResizePayload
    | TeamClusterDaemonSessionDetachPayload
    | TeamClusterDaemonSessionDataPayload
    | TeamClusterDaemonSessionEndPayload
    | TeamClusterDaemonExposureSnapshotPayload
    | TeamClusterDaemonExposureUpsertPayload
    | TeamClusterDaemonExposureRemovePayload
    | TeamClusterDaemonTunnelOpenPayload
    | TeamClusterDaemonTunnelStatePayload
    | TeamClusterDaemonTunnelDataPayload
    | TeamClusterDaemonTunnelClosePayload
    | TeamClusterDaemonTunnelHeartbeatPayload
    | TeamClusterDaemonRuntimeProgressPayload
    | TeamClusterDaemonServerEventMessage;
