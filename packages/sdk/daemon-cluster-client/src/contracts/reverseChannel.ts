
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

export interface TeamClusterDaemonExposureSnapshotPayload {
    type: 'exposure-snapshot';
    exposures: unknown[];
};

export interface TeamClusterDaemonExposureUpsertPayload {
    type: 'exposure-upsert';
    exposures: unknown[];
};

export interface TeamClusterDaemonExposureRemovePayload {
    type: 'exposure-remove';
    exposureIds: string[];
};

export interface TeamClusterDaemonExposureTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    exposureId: string;
    accessMode: string;
};

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

export interface TeamClusterDaemonTunnelStatePayload {
    type: 'tunnel-state';
    sessionId: string;
    status: TeamClusterTunnelSessionStatus;
    message?: string;
    error?: string;
};

export interface TeamClusterDaemonTunnelDataPayload {
    type: 'tunnel-data';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
    sequence?: number;
    requiresAck?: boolean;
};

export interface TeamClusterDaemonTunnelDrainPayload {
    type: 'tunnel-drain';
    sessionId: string;
    sequence: number;
};

export interface TeamClusterDaemonTunnelClosePayload {
    type: 'tunnel-close';
    sessionId: string;
    code?: number;
    message?: string;
};

export interface TeamClusterDaemonTunnelHeartbeatPayload {
    type: 'tunnel-heartbeat';
    sessionId: string;
    occurredAt: string;
};

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
