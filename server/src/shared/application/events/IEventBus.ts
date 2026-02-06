import { IDomainEvent } from './IDomainEvent';
import { IEventHandler } from './IEventHandler';

export interface IEventBus{
    publish(event: IDomainEvent): Promise<void>;

    subscribe<T extends IDomainEvent>(
        eventName: string,
        handler: IEventHandler<T>
    ): Promise<void>;
};