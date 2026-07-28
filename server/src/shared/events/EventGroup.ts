export type EventName = keyof EventMap & string;

/** A group method receives the event's payload directly, already typed by its name. */
export type EventHandler<K extends EventName> = (payload: EventMap[K]) => unknown;

export interface EventBinding {
    event: EventName;
    handlerName: string | symbol;
}

const groupByClass = new WeakMap<object, string>();
const eventsByClass = new WeakMap<object, EventBinding[]>();

/**
 * Marks a class as a module's event surface. The label identifies the group in
 * subscription logs, the same way `@DefineEventGroup` does in a controller.
 */
export const DefineEventGroup = (group: string): ClassDecorator =>
    (target) => {
        groupByClass.set(target, group);
    };

export const getEventGroup = (controller: object): string | undefined => groupByClass.get(controller);

/**
 * Subscribes the decorated method to a domain event. `EventMap` constrains both
 * the name and the payload, so a typo cannot compile and a payload mismatch
 * surfaces on the method instead of at runtime.
 */
export const Event = <K extends EventName>(event: K) =>
    <THandler extends EventHandler<K>>(
        target: object,
        handlerName: string | symbol,
        _descriptor: TypedPropertyDescriptor<THandler>
    ): void => {
        const list = eventsByClass.get(target.constructor) ?? [];
        list.push({
            event,
            handlerName
        });
        eventsByClass.set(target.constructor, list);
    };

export const getEvents = (controller: object): EventBinding[] => eventsByClass.get(controller) ?? [];
