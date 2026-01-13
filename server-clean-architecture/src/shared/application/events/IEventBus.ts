import { IDomainEvent } from "./IDomainEvent";

export interface IEventBus{
    publish(event: IDomainEvent): Promise<void>;
};