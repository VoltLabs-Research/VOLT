import type { IDomainEvent } from './IDomainEvent';
import type { IEventHandler } from './IEventHandler';

export interface IEventBus {
    publish(event: IDomainEvent): Promise<void>;

    subscribe<TPayload, TEvent extends IDomainEvent<TPayload>>(
        eventName: string,
        handler: IEventHandler<TEvent>
    ): Promise<void>;
}
