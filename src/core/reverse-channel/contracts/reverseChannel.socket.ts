import type { TeamClusterServiceExposureAccessMode } from '@/core/runtime/contracts/serviceExposure';
import type { TeamClusterDaemonResponseType, TeamClusterDaemonSessionKind, TeamClusterDaemonTerminalTarget, TeamClusterTunnelSessionStatus } from '@/core/reverse-channel/contracts/reverseChannel.constants';

export interface TeamClusterDaemonSocketHeaders {
    [key: string]: string;
};

interface TeamClusterDaemonRequestScopedPayload {
    requestId: string;
};

interface TeamClusterDaemonStreamScopedPayload extends TeamClusterDaemonRequestScopedPayload {
    streamId: string;
};

interface TeamClusterDaemonSessionScopedPayload {
    sessionId: string;
};

interface TeamClusterDaemonBinaryChunkPayload extends TeamClusterDaemonSessionScopedPayload {
    chunkBase64: string;
    isBinary: boolean;
};

interface TeamClusterDaemonMessagePayload {
    message?: string;
};

interface TeamClusterDaemonCodePayload {
    code?: number;
};

interface TeamClusterDaemonErrorPayload {
    error?: string;
};

export interface TeamClusterDaemonCommandMessage {
    type: 'command';
    requestId: string;
    command: string;
    responseType?: TeamClusterDaemonResponseType;
    payload?: Record<string, unknown>;
};

export interface TeamClusterDaemonSocketResponsePayload<T = unknown> extends TeamClusterDaemonRequestScopedPayload {
    type: 'response';
    ok: boolean;
    status: number;
    data?: T;
    bodyBase64?: string;
    headers?: TeamClusterDaemonSocketHeaders;
    message?: string;
    streamId?: string;
};

export interface TeamClusterDaemonSocketStreamPayload extends TeamClusterDaemonStreamScopedPayload {
    type: 'stream';
    chunkBase64: string;
};

export interface TeamClusterDaemonSocketStreamStatePayload
    extends TeamClusterDaemonStreamScopedPayload, TeamClusterDaemonMessagePayload {
    type: 'stream-end';
};

export interface TeamClusterDaemonSessionAttachPayload extends TeamClusterDaemonSessionScopedPayload {
    kind: TeamClusterDaemonSessionKind;
    terminalTarget?: TeamClusterDaemonTerminalTarget;
    containerId?: string;
    targetUrl?: string;
    protocols?: string[];
};

export interface TeamClusterDaemonSessionInputPayload extends TeamClusterDaemonBinaryChunkPayload {
    type: 'session-input';
};

export interface TeamClusterDaemonSessionResizePayload extends TeamClusterDaemonSessionScopedPayload {
    type: 'session-resize';
    rows: number;
    cols: number;
};

export interface TeamClusterDaemonSessionDetachPayload extends TeamClusterDaemonSessionScopedPayload {
    type: 'session-detach';
};

export interface TeamClusterDaemonSessionDataPayload extends TeamClusterDaemonBinaryChunkPayload {
    type: 'session-data';
};

export interface TeamClusterDaemonSessionEndPayload
    extends TeamClusterDaemonSessionScopedPayload,
        TeamClusterDaemonCodePayload,
        TeamClusterDaemonMessagePayload,
        TeamClusterDaemonErrorPayload {
    type: 'session-end';
};

interface TeamClusterDaemonTunnelOpenBasePayload extends TeamClusterDaemonSessionScopedPayload {
    type: 'tunnel-open';
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

export type TeamClusterDaemonTunnelOpenPayload =
    | TeamClusterDaemonExposureTunnelOpenPayload
    | TeamClusterDaemonDirectTunnelOpenPayload;

export interface TeamClusterDaemonTunnelStatePayload
    extends TeamClusterDaemonSessionScopedPayload,
        TeamClusterDaemonMessagePayload,
        TeamClusterDaemonErrorPayload {
    type: 'tunnel-state';
    status: TeamClusterTunnelSessionStatus;
};

export interface TeamClusterDaemonTunnelDataPayload extends TeamClusterDaemonBinaryChunkPayload {
    type: 'tunnel-data';
};

export interface TeamClusterDaemonTunnelClosePayload
    extends TeamClusterDaemonSessionScopedPayload, TeamClusterDaemonCodePayload, TeamClusterDaemonMessagePayload {
    type: 'tunnel-close';
};

export interface TeamClusterDaemonTunnelHeartbeatPayload extends TeamClusterDaemonSessionScopedPayload {
    type: 'tunnel-heartbeat';
    occurredAt: string;
};
