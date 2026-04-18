import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/server-event';
import type { AuthenticatedMessageContext } from '@/core/reverse-channel/contracts/authenticated';
import type {
    BufferedDaemonEventOptions,
    ClusterDaemonEventPublisher
} from '@/core/reverse-channel/infrastructure/events/cluster-daemon-event-publisher';
import type { RuntimeProgressMessage } from '@/core/runtime/contracts/reverse-channel-runtime';
import type { ExposureSnapshotMessage } from '@/modules/container/contracts/reverse-channel-container';

type ImmediateTransportMessage = ExposureSnapshotMessage | RuntimeProgressMessage | TeamClusterDaemonServerEventMessage;

export abstract class ClusterDaemonTransportEvents {
    protected constructor(protected readonly voltCloudConnection: ClusterDaemonEventPublisher) {}

    protected getMessageContext(): AuthenticatedMessageContext {
        return {
            daemonPassword: this.voltCloudConnection.getDaemonPassword(),
            teamClusterId: this.voltCloudConnection.getTeamClusterId()
        };
    }

    protected emitMessage(message: ImmediateTransportMessage): void {
        this.getMessageContext();
        this.voltCloudConnection.emitMessage(message);
    }

    protected emitBufferedMessage(
        message: TeamClusterDaemonServerEventMessage,
        options?: BufferedDaemonEventOptions
    ): void {
        this.getMessageContext();
        this.voltCloudConnection.emitBufferedMessage(message, options);
    }
}
