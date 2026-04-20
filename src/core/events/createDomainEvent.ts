import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';

export interface DomainEventClass<TPayload extends object> {
    new (payload: TPayload): BaseDomainEvent<TPayload>;
    readonly eventName: string;
}

export type PayloadOf<T> = T extends DomainEventClass<infer P> ? P : never;

export const createDomainEvent = <TPayload extends object>(
    eventName: string
): DomainEventClass<TPayload> => {
    const EventClass = class extends BaseDomainEvent<TPayload> {
        static readonly eventName = eventName;
        constructor(payload: TPayload) {
            super(eventName, payload);
        }
    };
    Object.defineProperty(EventClass, 'name', { value: eventName });
    return EventClass as DomainEventClass<TPayload>;
};
