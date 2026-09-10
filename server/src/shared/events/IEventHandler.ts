import type { IDomainEvent } from '@shared/events/IDomainEvent';

export interface IEventHandler<T extends IDomainEvent> {
    readonly label?: string;
    handle(event: T): Promise<void>;
}
