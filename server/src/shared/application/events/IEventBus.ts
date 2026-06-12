import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from './IEventHandler';

export interface IEventBus {
    publish(event: IDomainEvent): Promise<void>;

    subscribe<TPayload, TEvent extends IDomainEvent<TPayload>>(
        eventName: string,
        handler: IEventHandler<TEvent>
    ): Promise<void>;
}
