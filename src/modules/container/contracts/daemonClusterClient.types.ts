import type { ExposureSnapshotMessage, RuntimeProgressMessage, TeamClusterDaemonServerEventMessage } from '@/contracts';
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
