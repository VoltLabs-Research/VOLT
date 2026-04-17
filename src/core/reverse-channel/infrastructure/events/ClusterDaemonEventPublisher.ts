import type { ExposureSnapshotMessage } from '@/core/reverse-channel/contracts/messages/exposure-snapshot';
import type { RuntimeProgressMessage } from '@/core/reverse-channel/contracts/messages/runtime-progress';
import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/messages/server-event';

export interface BufferedDaemonEventOptions {
    dedupeKey?: string;
}

export interface ClusterDaemonEventPublisher {
    emitBufferedMessage(message: TeamClusterDaemonServerEventMessage, options?: BufferedDaemonEventOptions): void;
    emitMessage(message: ExposureSnapshotMessage | RuntimeProgressMessage | TeamClusterDaemonServerEventMessage): void;
    getDaemonPassword(): string;
    getTeamClusterId(): string;
}
