export type EventHandlerPayload = object | string | number | boolean | bigint | symbol | null | undefined;

export interface IEventHandlerEvent<TPayload = EventHandlerPayload> {
    readonly eventId: string;
    readonly name: string;
    readonly occurredOn: Date;
    readonly payload: TPayload;
}

export interface IEventHandler<TEvent extends IEventHandlerEvent = IEventHandlerEvent> {
    handle(event: TEvent): Promise<void> | void;
}
