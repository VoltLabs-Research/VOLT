import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { EventName } from '@shared/events/EventGroup';
import type { IEventHandler } from './IEventHandler';

export interface IEventBus {
    emit<K extends EventName>(name: K, payload: EventMap[K]): Promise<void>;

    subscribe<TPayload, TEvent extends IDomainEvent<TPayload>>(
        eventName: string,
        handler: IEventHandler<TEvent>
    ): Promise<void>;
}
