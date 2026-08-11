import type { DomainEventClass } from '@shared/domain/events/create-domain-event';
import type { AuthenticatedMessageContext } from '@shared/contracts/channel/reverse-channel-messaging';
import type { TeamClusterDaemonServerEventMessage } from '@shared/contracts/channel/server-event';
import type { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';

type StatusTripleEventMap<TPayload extends object, TStatus extends string> = {
    readonly [K in TStatus]: DomainEventClass<TPayload> | DomainEventClass<TPayload & { error: string }>;
};

interface StatusTripleOptions<TPayload extends object, TStatus extends string> {
    readonly bridge: DomainEventBridge;
    readonly events: StatusTripleEventMap<TPayload, TStatus>;
    readonly buildMessage: (
        ctx: AuthenticatedMessageContext,
        payload: TPayload,
        status: TStatus
    ) => TeamClusterDaemonServerEventMessage;
    readonly buildDedupeKey: (payload: TPayload, status: TStatus) => string;
}

export const registerStatusTriple = <TPayload extends object, TStatus extends string>(
    opts: StatusTripleOptions<TPayload, TStatus>
): void => {
    const entries = Object.entries(opts.events) as Array<[TStatus, DomainEventClass<TPayload>]>;
    for (const [status, EventClass] of entries) {
        opts.bridge.register(EventClass, (payload, { messageContext }) => ({
            kind: 'buffered' as const,
            message: opts.buildMessage(messageContext, payload, status),
            options: { dedupeKey: opts.buildDedupeKey(payload, status) }
        }));
    }
};
