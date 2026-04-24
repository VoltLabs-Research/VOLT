import { randomUUID } from 'node:crypto';
import type { IDomainEvent } from '@/core/events/IDomainEvent';

export interface DomainEventClass<TPayload extends object> {
    new (payload: TPayload): IDomainEvent<TPayload>;
    readonly eventName: string;
}

export type PayloadOf<T> = T extends DomainEventClass<infer P> ? P : never;

export const createDomainEvent = <TPayload extends object>(
    eventName: string
): DomainEventClass<TPayload> => {
    const EventClass = class implements IDomainEvent<TPayload> {
        static readonly eventName = eventName;
        readonly eventId = randomUUID();
        readonly occurredOn = new Date();
        readonly name = eventName;
        constructor(readonly payload: TPayload) {}
    };
    Object.defineProperty(EventClass, 'name', { value: eventName });
    return EventClass as DomainEventClass<TPayload>;
};
