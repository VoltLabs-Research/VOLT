import type { TeamClusterDaemonRuntimeProgressPayload } from '@/shared/contracts';
import type { TeamClusterDaemonMessage } from '@voltstack/daemon-cluster-client';

type NonCommandMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;

declare module '@voltstack/daemon-cluster-client' {
    interface ClusterDaemonClient {
        emit(message: NonCommandMessage | TeamClusterDaemonRuntimeProgressPayload): void;
    }
}

export {};
