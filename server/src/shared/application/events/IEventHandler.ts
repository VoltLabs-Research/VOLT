import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';

export interface IEventHandler<T extends IDomainEvent> {
    /** Identifies this subscription in the bus logs; falls back to the class name. */
    readonly label?: string;
    handle(event: T): Promise<void>;
}
