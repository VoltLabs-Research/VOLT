import type {
    TeamClusterDaemonSessionKind,
    TeamClusterDaemonTerminalTarget,
    TeamClusterTunnelSessionStatus
} from '@/core/reverse-channel/contracts/reverse-channel-constants';
import type { TeamClusterServiceExposureAccessMode } from '@/core/runtime/contracts/service-exposure';

interface TeamClusterDaemonBinaryPayload {
    sessionId: string;
    chunkBase64: string;
    isBinary: boolean;
}

interface TeamClusterDaemonClosePayload {
    sessionId: string;
    code?: number;
    message?: string;
}

export interface TeamClusterDaemonBinaryRelayDescriptor {
    relaySessionId: string;
    relayUrl: string;
    relayToken: string;
    relayProtocolVersion: 1;
}

export interface TeamClusterDaemonSessionAttachPayload {
    sessionId: string;
    kind: TeamClusterDaemonSessionKind;
    terminalTarget?: TeamClusterDaemonTerminalTarget;
    containerId?: string;
    targetUrl?: string;
    protocols?: string[];
}

export type TeamClusterDaemonTerminalSessionAttachPayload = TeamClusterDaemonSessionAttachPayload & {
    kind: 'terminal';
    terminalTarget: TeamClusterDaemonTerminalTarget;
};

export type TeamClusterDaemonWebSocketSessionAttachPayload = TeamClusterDaemonSessionAttachPayload & {
    kind: 'websocket';
    targetUrl: string;
};

export interface TeamClusterDaemonSessionInputPayload extends TeamClusterDaemonBinaryPayload {
    type: 'session-input';
}

export interface TeamClusterDaemonSessionResizePayload {
    type: 'session-resize';
    sessionId: string;
    rows: number;
    cols: number;
}

export interface TeamClusterDaemonSessionDataPayload extends TeamClusterDaemonBinaryPayload {
    type: 'session-data';
}

export interface TeamClusterDaemonSessionEndPayload extends TeamClusterDaemonClosePayload {
    type: 'session-end';
    error?: string;
}

interface TeamClusterDaemonTunnelOpenBasePayload {
    sessionId: string;
    type: 'tunnel-open';
    accessMode: TeamClusterServiceExposureAccessMode;
    relay?: TeamClusterDaemonBinaryRelayDescriptor;
}

interface TeamClusterDaemonExposureTunnelOpenPayload extends TeamClusterDaemonTunnelOpenBasePayload {
    exposureId: string;
}

interface TeamClusterDaemonDirectTunnelOpenPayload extends TeamClusterDaemonTunnelOpenBasePayload {
    targetHost: string;
    targetPort: number;
}

export type TeamClusterDaemonTunnelOpenPayload =
    | TeamClusterDaemonExposureTunnelOpenPayload
    | TeamClusterDaemonDirectTunnelOpenPayload;

export interface TeamClusterDaemonTunnelStatePayload {
    type: 'tunnel-state';
    sessionId: string;
    status: TeamClusterTunnelSessionStatus;
    message?: string;
    error?: string;
}

export interface TeamClusterDaemonTunnelDataPayload extends TeamClusterDaemonBinaryPayload {
    type: 'tunnel-data';
}

export interface TeamClusterDaemonTunnelClosePayload extends TeamClusterDaemonClosePayload {
    type: 'tunnel-close';
}
