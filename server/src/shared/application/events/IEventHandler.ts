import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';

export interface IEventHandler<T extends IDomainEvent> {
    readonly label?: string;
    handle(event: T): Promise<void>;
}
