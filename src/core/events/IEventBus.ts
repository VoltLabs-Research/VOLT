import type { IDomainEvent } from '@/core/events/IDomainEvent';
import type { IEventHandler } from '@/core/events/IEventHandler';

export interface IEventBus {
    publish(event: IDomainEvent): Promise<void>;
    subscribe(eventName: string, handler: IEventHandler): Promise<void>;
}
