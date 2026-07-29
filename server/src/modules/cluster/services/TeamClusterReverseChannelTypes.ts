
import type { TeamClusterServiceExposureAccessMode } from '@shared/contracts/types/TeamClusterExposure';
import type {
    TeamClusterDaemonResponseType,
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSocketChannel,
    TeamClusterDaemonSocketHeaders
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import type { PassThrough } from 'node:stream';

export type TeamClusterDaemonCommandData = Record<string, unknown> | TeamClusterDaemonSessionAttachPayload;

export interface TeamClusterDaemonCommandPayload {
    command: string;
    payload?: TeamClusterDaemonCommandData;
    responseType: TeamClusterDaemonResponseType;
}

export interface TeamClusterCommandOptions {
    timeoutMs?: number;
}

export interface TeamClusterDaemonSocketRegistration {
    teamClusterId: string;
    channel: TeamClusterDaemonSocketChannel;
}

export interface TeamClusterExposureTunnelOpenRequest {
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export interface TeamClusterDirectTunnelOpenRequest {
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export type TeamClusterTunnelOpenRequest = TeamClusterExposureTunnelOpenRequest | TeamClusterDirectTunnelOpenRequest;

export interface TeamClusterTunnelOpenOptions {
    timeoutMs?: number;
    timeoutMessage?: string;
}

export interface TeamClusterReverseChannelStreamAttachment {
    status: number;
    headers: TeamClusterDaemonSocketHeaders;
    stream: PassThrough;
}

export interface TeamClusterDaemonInboundStreamPayload {
    socketId: string;
    teamClusterId: string;
    requestId: string;
    streamId: string;
    chunk: Buffer;
}

export type TeamClusterDaemonInboundStreamConsumer = (payload: TeamClusterDaemonInboundStreamPayload) => void | Promise<void>;

