import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { EventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import type { DomainEventClass } from '@shared/domain/events/createDomainEvent';
import type { AuthenticatedMessageContext } from '@shared/contracts/channel/reverse-channel-messaging';
import type { TeamClusterDaemonServerEventMessage } from '@shared/contracts/channel/server-event';
import type {
    BufferedDaemonEventOptions,
    ClusterDaemonEventPublisher,
    ImmediateTransportMessage
} from '@shared/infrastructure/events/cluster-daemon-event-publisher';

export interface BufferedMessageEnvelope {
    readonly kind: 'buffered';
    readonly message: TeamClusterDaemonServerEventMessage;
    readonly options?: BufferedDaemonEventOptions;
}

export interface ImmediateMessageEnvelope {
    readonly kind: 'immediate';
    readonly message: ImmediateTransportMessage;
}

export type TransportMessageEnvelope = BufferedMessageEnvelope | ImmediateMessageEnvelope;

export interface DomainEventTransportContext {
    readonly messageContext: AuthenticatedMessageContext;
}

export type DomainEventTransportMapper<TPayload extends object> = (
    payload: TPayload,
    context: DomainEventTransportContext
) => TransportMessageEnvelope | readonly TransportMessageEnvelope[] | null;

export class DomainEventBridge {
    private readonly mappers = new Map<string, DomainEventTransportMapper<object>>();
    private messageContext: AuthenticatedMessageContext | null = null;

    constructor(private readonly publisher: ClusterDaemonEventPublisher) {}

    register<TPayload extends object>(
        eventClass: DomainEventClass<TPayload>,
        mapper: DomainEventTransportMapper<TPayload>
    ): void {
        if (this.mappers.has(eventClass.eventName)) {
            throw new Error(`Domain event already registered with DomainEventBridge: ${eventClass.eventName}`);
        }

        this.mappers.set(eventClass.eventName, mapper as unknown as DomainEventTransportMapper<object>);
    }

    subscribeAll(eventDispatcher: EventDispatcher): void {
        const context: DomainEventTransportContext = { messageContext: this.getMessageContext() };
        for (const [name, mapper] of this.mappers) {
            eventDispatcher.subscribe(name, (event) => this.handle(event, mapper, context));
        }
    }

    private handle(
        event: IDomainEvent,
        mapper: DomainEventTransportMapper<object>,
        context: DomainEventTransportContext
    ): void {
        const result = mapper(event.payload, context);
        if (result === null) {
            return;
        }

        const envelopes = Array.isArray(result) ? result : [result as TransportMessageEnvelope];
        for (const envelope of envelopes) {
            this.emit(envelope);
        }
    }

    private emit(envelope: TransportMessageEnvelope): void {
        if (envelope.kind === 'buffered') {
            this.publisher.emitBufferedMessage(envelope.message, envelope.options);
            return;
        }

        this.publisher.emitMessage(envelope.message);
    }

    private getMessageContext(): AuthenticatedMessageContext {
        if (!this.messageContext) {
            const client = this.publisher.client;
            this.messageContext = {
                daemonPassword: client.getDaemonPassword(),
                teamClusterId: client.getTeamClusterId()
            };
        }
        return this.messageContext;
    }
}
