import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';

export interface IEventHandler<T extends IDomainEvent> {
    handle(event: T): Promise<void>;
}
