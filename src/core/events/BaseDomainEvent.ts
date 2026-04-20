import { randomUUID } from 'node:crypto';
import type { IDomainEvent } from '@/core/events/IDomainEvent';

export abstract class BaseDomainEvent<TPayload extends object = object> implements IDomainEvent<TPayload> {
    readonly eventId = randomUUID();
    readonly occurredOn = new Date();

    protected constructor(
        public readonly name: string,
        public readonly payload: TPayload
    ) {}
}
