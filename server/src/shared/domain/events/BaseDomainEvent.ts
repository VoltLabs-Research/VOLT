import { IDomainEvent } from './IDomainEvent';
import { v4 } from 'uuid';

export abstract class BaseDomainEvent<T> implements IDomainEvent {
    readonly occurredOn = new Date();
    readonly eventId = v4();

    constructor(
        public readonly name: string,
        public readonly payload: T
    ) {}
}
