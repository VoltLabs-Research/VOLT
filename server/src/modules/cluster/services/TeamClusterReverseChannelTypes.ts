import type { ContainerTerminalAttachment } from '@shared/contracts/ports';
import type { TeamClusterServiceExposureAccessMode } from '@shared/contracts/types/TeamClusterExposure';
import type { TeamClusterTunnelStream } from '@modules/cluster/services/TeamClusterReverseTunnelStream';
import type { TeamClusterReverseWebSocketStream } from '@modules/cluster/services/TeamClusterReverseWebSocket';
import type {
    TeamClusterDaemonMessage,
    TeamClusterDaemonResponseType,
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSocketChannel,
    TeamClusterDaemonSocketHeaders,
    TeamClusterDaemonSocketResponsePayload
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

export interface ITeamClusterReverseChannelService {
    registerDaemonConnection(
        socketId: string,
        teamClusterId: string,
        channel?: TeamClusterDaemonSocketChannel
    ): void;
    unregisterDaemonConnection(socketId: string): TeamClusterDaemonSocketRegistration | null;
    isRegisteredDaemonSocket(socketId: string): boolean;
    getRegisteredTeamClusterId(socketId: string): string | null;
    hasDaemonConnection(teamClusterId: string, channel: TeamClusterDaemonSocketChannel): boolean;
    registerInboundStreamConsumer(
        streamId: string,
        consumer: TeamClusterDaemonInboundStreamConsumer
    ): () => void;
    command(
        teamClusterId: string,
        payload: TeamClusterDaemonCommandPayload,
        options?: TeamClusterCommandOptions
    ): Promise<TeamClusterDaemonSocketResponsePayload>;
    openStream(teamClusterId: string, payload: TeamClusterDaemonCommandPayload): Promise<PassThrough>;
    openCommandStream(
        teamClusterId: string,
        payload: TeamClusterDaemonCommandPayload
    ): Promise<TeamClusterReverseChannelStreamAttachment>;
    attachWebSocket(
        teamClusterId: string,
        targetUrl: string,
        protocols?: string[]
    ): Promise<TeamClusterReverseWebSocketStream>;
    attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment>;
    openTunnel(
        teamClusterId: string,
        exposureId: string,
        accessMode: TeamClusterServiceExposureAccessMode,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterTunnelStream>;
    openTunnel(
        teamClusterId: string,
        request: TeamClusterTunnelOpenRequest,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterTunnelStream>;
    handleMessage(socketId: string, payload: TeamClusterDaemonMessage): void;
}
