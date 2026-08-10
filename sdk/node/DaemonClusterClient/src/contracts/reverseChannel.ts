/**
 * All wire types exchanged over the reverse channel (`team-cluster-daemon:message`).
 * These are shared between the SDK and any consumer that needs to interop with the
 * Volt server control plane.
 *
 * Chunk-carrying frames travel as binary: socket.io transmits the `Uint8Array`
 * as a binary attachment. (Older revisions of this contract declared base64
 * strings; the transport moved to binary framing.)
 */

import type { ProgressStageType } from './events';

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

/** Socket planes a daemon registers on; presence of the lifecycle planes marks the cluster connected. */
export const TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL = Object.freeze({
    Heartbeat: 'heartbeat',
    Control: 'control',
    ObjectGateway: 'object-gateway',
    Events: 'events'
});

export type TeamClusterDaemonSocketChannel = ValueOf<typeof TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL>;

export interface TeamClusterDaemonSocketHeaders {
    [key: string]: string;
};

export interface TeamClusterDaemonRegisterPayload {
    teamClusterId: string;
    daemonPassword: string;
    channel?: TeamClusterDaemonSocketChannel;
};

export interface TeamClusterDaemonCommandMessage {
    type: 'command';
    requestId: string;
    command: string;
    responseType?: TeamClusterDaemonResponseType;
    payload?: unknown;
};

/**
 * Every JSON reply on the reverse channel wraps the handler result one level in:
 * `data` is the envelope and the handler result sits inside it. The handler result
 * itself may be an error report, which is why it is a declared union member.
 */
export interface TeamClusterDaemonSuccessEnvelope<T> {
    status: 'success';
    data: T;
};

export interface TeamClusterDaemonErrorResult {
    status: 'error';
    code: string;
    message: string;
};

export interface TeamClusterDaemonSocketResponsePayload<T = unknown> {
    type: 'response';
    requestId: string;
    ok: boolean;
    status: number;
    data?: TeamClusterDaemonSuccessEnvelope<T | TeamClusterDaemonErrorResult>;
    headers?: TeamClusterDaemonSocketHeaders;
    message?: string;
    streamId?: string;
};

export interface TeamClusterDaemonSocketStreamPayload {
    type: 'stream';
    requestId: string;
    streamId: string;
    chunk: Uint8Array;
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
    /**
     * WebSocket subprotocols to negotiate with the upstream (e.g.
     * `v1.kernel.websocket.jupyter.org`). Required so the daemon can match the
     * subprotocol the browser negotiated; without it the upstream falls back to
     * text frames while the browser expects binary, breaking the connection.
     */
    protocols?: string[];
};

export interface TeamClusterDaemonSessionAttachResult {
    attached: boolean;
    selectedProtocol?: string;
};

export interface TeamClusterDaemonSessionInputPayload {
    type: 'session-input';
    sessionId: string;
    chunk: Uint8Array;
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
    chunk: Uint8Array;
    isBinary: boolean;
};

export interface TeamClusterDaemonSessionEndPayload {
    type: 'session-end';
    sessionId: string;
    code?: number;
    message?: string;
    error?: string;
};

/** Replaces the full exposure registry for a connected team cluster. */
export interface TeamClusterDaemonExposureSnapshotPayload {
    type: 'exposure-snapshot';
    exposures: unknown[];
};

/** Applies additive exposure changes without replacing the full registry. */
export interface TeamClusterDaemonExposureUpsertPayload {
    type: 'exposure-upsert';
    exposures: unknown[];
};

/** Removes exposures that are no longer published by the daemon. */
export interface TeamClusterDaemonExposureRemovePayload {
    type: 'exposure-remove';
    exposureIds: string[];
};

/** Opens a generic tunnel session against a persistent exposure. */
export interface TeamClusterDaemonExposureTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    exposureId: string;
    accessMode: string;
};

/**
 * The object gateway connection opens tunnels straight at a host:port instead of
 * naming a published exposure, so `tunnel-open` has two legitimate shapes.
 */
export interface TeamClusterDaemonDirectTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: string;
};

export type TeamClusterDaemonTunnelOpenPayload =
    | TeamClusterDaemonExposureTunnelOpenPayload
    | TeamClusterDaemonDirectTunnelOpenPayload;

/** Acknowledges the final state of a tunnel session transition. */
export interface TeamClusterDaemonTunnelStatePayload {
    type: 'tunnel-state';
    sessionId: string;
    status: TeamClusterTunnelSessionStatus;
    message?: string;
    error?: string;
};

/** Carries raw tunnel bytes for HTTP, WebSocket or arbitrary TCP sessions. */
export interface TeamClusterDaemonTunnelDataPayload {
    type: 'tunnel-data';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
    sequence?: number;
    requiresAck?: boolean;
};

/** Acknowledges tunnel bytes up to a sequence number so the sender can release them. */
export interface TeamClusterDaemonTunnelDrainPayload {
    type: 'tunnel-drain';
    sessionId: string;
    sequence: number;
};

/** Closes a generic tunnel session on either side of the reverse channel. */
export interface TeamClusterDaemonTunnelClosePayload {
    type: 'tunnel-close';
    sessionId: string;
    code?: number;
    message?: string;
};

/** Keeps long-lived tunnel sessions observable without transferring business data. */
export interface TeamClusterDaemonTunnelHeartbeatPayload {
    type: 'tunnel-heartbeat';
    sessionId: string;
    occurredAt: string;
};

/**
 * The documented shape of the `payload` carried by container-create
 * `runtime-progress` frames. The field itself is open (`Record<string, unknown>`)
 * because other actions (e.g. analysis dispatch) carry different payloads such as
 * trace context.
 */
export interface TeamClusterDaemonContainerCreateProgress {
    operationId: string;
    step?: string;
    image?: string;
    containerName?: string;
    containerId?: string;
};

export interface TeamClusterDaemonRuntimeProgressPayload {
    type: 'runtime-progress';
    action: string;
    stage: ProgressStageType;
    timestamp: string;
    payload?: Record<string, unknown>;
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
    | TeamClusterDaemonTunnelDrainPayload
    | TeamClusterDaemonTunnelClosePayload
    | TeamClusterDaemonTunnelHeartbeatPayload
    | TeamClusterDaemonRuntimeProgressPayload;
