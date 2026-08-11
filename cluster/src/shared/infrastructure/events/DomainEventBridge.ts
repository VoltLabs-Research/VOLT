import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { EventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import type { DomainEventClass } from '@shared/domain/events/create-domain-event';
import type { AuthenticatedMessageContext } from '@shared/contracts/channel/reverse-channel-messaging';
import type { TeamClusterDaemonServerEventMessage } from '@shared/contracts/channel/server-event';
import type {
    BufferedDaemonEventOptions,
    ClusterDaemonEventPublisher,
    ImmediateTransportMessage
} from '@shared/infrastructure/events/cluster-daemon-event-publisher';

interface BufferedMessageEnvelope {
    readonly kind: 'buffered';
    readonly message: TeamClusterDaemonServerEventMessage;
    readonly options?: BufferedDaemonEventOptions;
}

interface ImmediateMessageEnvelope {
    readonly kind: 'immediate';
    readonly message: ImmediateTransportMessage;
}

type TransportMessageEnvelope = BufferedMessageEnvelope | ImmediateMessageEnvelope;

interface DomainEventTransportContext {
    readonly messageContext: AuthenticatedMessageContext;
}

type DomainEventTransportMapper<TPayload extends object> = (
    payload: TPayload,
    context: DomainEventTransportContext
) => TransportMessageEnvelope | readonly TransportMessageEnvelope[] | null;

/**
 * A mapper that has already closed over the payload type it was registered with. Storing the
 * adapted form keeps the map homogeneous without claiming a `Mapper<Specific>` *is* a
 * `Mapper<object>` — which would be unsound, since mapper payloads are contravariant.
 */
type BoundDomainEventMapper = DomainEventTransportMapper<object>;

export class DomainEventBridge {
    private readonly mappers = new Map<string, BoundDomainEventMapper>();
    private messageContext: AuthenticatedMessageContext | null = null;

    constructor(private readonly publisher: ClusterDaemonEventPublisher) {}

    register<TPayload extends object>(
        eventClass: DomainEventClass<TPayload>,
        mapper: DomainEventTransportMapper<TPayload>
    ): void {
        if (this.mappers.has(eventClass.eventName)) {
            throw new Error(`Domain event already registered with DomainEventBridge: ${eventClass.eventName}`);
        }

        // The dispatcher routes by event name, so a payload arriving here is this mapper's own.
        this.mappers.set(eventClass.eventName, (payload, context) => mapper(payload as TPayload, context));
    }

    subscribeAll(eventDispatcher: EventDispatcher): void {
        const context: DomainEventTransportContext = { messageContext: this.getMessageContext() };
        for (const [name, mapper] of this.mappers) {
            eventDispatcher.subscribe(name, (event) => this.handle(event, mapper, context));
        }
    }

    private handle(
        event: IDomainEvent,
        mapper: BoundDomainEventMapper,
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
