import type { DomainEventClass } from '@/core/events/createDomainEvent';
import type { AuthenticatedMessageContext } from '@/core/reverse-channel/contracts/reverse-channel-messaging';
import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/server-event';
import type { DomainEventBridge } from '@/core/reverse-channel/infrastructure/events/DomainEventBridge';

/**
 * Each (status, event class) entry may carry a richer payload than the base
 * `TPayload` consumed by the builders — typically a `Failed<T>` for the
 * `failed` status. The builders only read the shared fields, so accepting a
 * wider class per entry keeps the call sites type-safe without forcing
 * artificial payload unions.
 */
export type StatusTripleEventMap<TPayload extends object, TStatus extends string> = {
    readonly [K in TStatus]: DomainEventClass<TPayload> | DomainEventClass<TPayload & { error: string }>;
};

export interface StatusTripleOptions<TPayload extends object, TStatus extends string> {
    readonly bridge: DomainEventBridge;
    readonly events: StatusTripleEventMap<TPayload, TStatus>;
    readonly buildMessage: (
        ctx: AuthenticatedMessageContext,
        payload: TPayload,
        status: TStatus
    ) => TeamClusterDaemonServerEventMessage;
    readonly buildDedupeKey: (payload: TPayload, status: TStatus) => string;
}

/**
 * Registers a buffered transport mapping for each (status, eventClass) entry.
 * Replaces the 3-line-per-status buildXxxMapper boilerplate in the per-module
 * register-*-event-mappers files.
 */
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
