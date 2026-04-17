import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/messages/server-event';
import type { AuthenticatedMessageContext } from '@/core/reverse-channel/contracts/messages/shared/authenticated';
import type { ExposureSnapshotMessage } from '@/core/reverse-channel/contracts/messages/exposure-snapshot';
import type { RuntimeProgressMessage } from '@/core/reverse-channel/contracts/messages/runtime-progress';
import type { ClusterDaemonEventPublisher } from '@/core/reverse-channel/infrastructure/events/ClusterDaemonEventPublisher';
import type { IDomainEvent } from '@/core/events/IDomainEvent';
import type { IEventHandler } from '@/core/events/IEventHandler';

type ImmediateTransportMessage = ExposureSnapshotMessage | RuntimeProgressMessage | TeamClusterDaemonServerEventMessage;

abstract class ClusterDaemonTransportSubscriber<TEvent extends IDomainEvent> implements IEventHandler<TEvent> {
    protected constructor(
        protected readonly event: TEvent,
        protected readonly voltCloudConnection: ClusterDaemonEventPublisher
    ) {
        void this.getMessageContext;
    }

    protected getMessageContext(): AuthenticatedMessageContext {
        return {
            daemonPassword: this.voltCloudConnection.getDaemonPassword(),
            teamClusterId: this.voltCloudConnection.getTeamClusterId()
        };
    }

    abstract handle(): Promise<void> | void;
}

export abstract class ImmediateTransportEventSubscriber<TEvent extends IDomainEvent> extends ClusterDaemonTransportSubscriber<TEvent> {
    protected abstract buildMessage(event: TEvent): ImmediateTransportMessage;

    handle(): void {
        this.getMessageContext();
        void this.buildMessage;
        this.voltCloudConnection.emitMessage(this.buildMessage(this.event));
    }
}

export abstract class BufferedTransportEventSubscriber<TEvent extends IDomainEvent> extends ClusterDaemonTransportSubscriber<TEvent> {
    protected abstract buildMessage(event: TEvent): TeamClusterDaemonServerEventMessage;

    protected getDedupeKey(_event: TEvent): string | undefined {
        return undefined;
    }

    handle(): void {
        this.getMessageContext();
        void this.buildMessage;
        void this.getDedupeKey;
        const dedupeKey = this.getDedupeKey(this.event);

        this.voltCloudConnection.emitBufferedMessage(
            this.buildMessage(this.event),
            dedupeKey ? { dedupeKey } : undefined
        );
    }
}
