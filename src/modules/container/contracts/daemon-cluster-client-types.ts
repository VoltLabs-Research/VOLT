import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/server-event';
import type { RuntimeProgressMessage } from '@/core/runtime/contracts/reverse-channel-runtime';
import type { ExposureSnapshotMessage } from '@/modules/container/contracts/reverse-channel-container';
import type { TeamClusterDaemonMessage } from '@voltstack/daemon-cluster-client';

interface TeamClusterDaemonCommandEnvelope {
    type: 'command';
}

type NonCommandMessage = Exclude<TeamClusterDaemonMessage, TeamClusterDaemonCommandEnvelope>;

declare module '@voltstack/daemon-cluster-client' {
    interface ClusterDaemonClient {
        emit(message: NonCommandMessage | ExposureSnapshotMessage | RuntimeProgressMessage | TeamClusterDaemonServerEventMessage): void;
    }
}

export {};
