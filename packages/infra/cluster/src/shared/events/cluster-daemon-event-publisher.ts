import type { TeamClusterDaemonServerEventMessage } from '@shared/contracts/channel/server-event';
import type { RuntimeProgressMessage } from '@shared/contracts/types/reverse-channel-runtime';
import type { ExposureSnapshotMessage } from '@shared/contracts/types/container-types';

export interface BufferedDaemonEventOptions {
    dedupeKey?: string;
}

export type ImmediateTransportMessage = ExposureSnapshotMessage | RuntimeProgressMessage | TeamClusterDaemonServerEventMessage;

interface ClusterDaemonEventPublisherClient {
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
