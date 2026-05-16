import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/server-event';
import type { RuntimeProgressMessage } from '@/core/runtime/contracts/reverse-channel-runtime';
import type { ExposureSnapshotMessage } from '@/modules/container/contracts/container-types';

export interface BufferedDaemonEventOptions {
    dedupeKey?: string;
}

export type ImmediateTransportMessage = ExposureSnapshotMessage | RuntimeProgressMessage | TeamClusterDaemonServerEventMessage;

export interface ClusterDaemonEventPublisherClient {
    getDaemonPassword(): string;
    getTeamClusterId(): string;
}

export interface ClusterDaemonEventPublisher {
    emitBufferedMessage(
        message: TeamClusterDaemonServerEventMessage, 
        options?: BufferedDaemonEventOptions
    ): void;

    emitMessage(message: ImmediateTransportMessage): void;

    client: ClusterDaemonEventPublisherClient;
}
