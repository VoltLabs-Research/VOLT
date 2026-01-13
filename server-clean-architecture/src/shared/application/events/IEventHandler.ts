import { IDomainEvent } from "./IDomainEvent";

export interface IEventHandler<T extends IDomainEvent>{
    handle(event: T): Promise<void>;
};