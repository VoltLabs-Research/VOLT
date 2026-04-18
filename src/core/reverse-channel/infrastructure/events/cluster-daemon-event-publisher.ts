import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/server-event';
import type { RuntimeProgressMessage } from '@/core/runtime/contracts/reverse-channel-runtime';
import type { ExposureSnapshotMessage } from '@/modules/container/contracts/reverse-channel-container';

export interface BufferedDaemonEventOptions {
    dedupeKey?: string;
}

export interface ClusterDaemonEventPublisher {
    emitBufferedMessage(message: TeamClusterDaemonServerEventMessage, options?: BufferedDaemonEventOptions): void;
    emitMessage(message: ExposureSnapshotMessage | RuntimeProgressMessage | TeamClusterDaemonServerEventMessage): void;
    getDaemonPassword(): string;
    getTeamClusterId(): string;
}
