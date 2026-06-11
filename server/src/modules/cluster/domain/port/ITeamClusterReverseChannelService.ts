import type {
    ContainerTerminalAttachment
} from '@modules/container/domain/port/IContainerService';
import type { TeamClusterTunnelStream } from '@modules/cluster/utilities/TeamClusterReverseTunnelStream';
import type { TeamClusterReverseWebSocketStream } from '@modules/cluster/utilities/teamClusterReverseWebSocket';
import type {
    TeamClusterServiceExposureAccessMode,
    TeamClusterDaemonMessage,
    TeamClusterDaemonSocketResponsePayload,
    TeamClusterDaemonSocketChannel
} from '@modules/cluster/utilities/teamClusterSocket';
import type {
    TeamClusterCommandOptions,
    TeamClusterDaemonCommandPayload,
    TeamClusterDaemonInboundStreamConsumer,
    TeamClusterDaemonSocketRegistration,
    TeamClusterReverseChannelStreamAttachment,
    TeamClusterTunnelOpenOptions,
    TeamClusterTunnelOpenRequest
} from '@modules/cluster/domain/contracts/TeamClusterReverseChannel';
import type { PassThrough } from 'node:stream';

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
