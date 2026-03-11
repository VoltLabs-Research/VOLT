import {
    TeamClusterServiceExposureAccessMode,
    type TeamClusterServiceExposure
} from './serviceExposure';

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

/**
 * Opens a generic tunnel session against a persistent exposure.
 */
export interface TeamClusterDaemonTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
};

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
    | TeamClusterDaemonTunnelHeartbeatPayload;
