export type EventName = keyof EventMap & string;

type EventHandler<K extends EventName> = (payload: EventMap[K]) => unknown;

interface EventBinding {
    event: EventName;
    handlerName: string | symbol;
}

const groupByClass = new WeakMap<object, string>();
const eventsByClass = new WeakMap<object, EventBinding[]>();

export const DefineEventGroup = (group: string): ClassDecorator =>
    (target) => {
        groupByClass.set(target, group);
    };

export const getEventGroup = (controller: object): string | undefined => groupByClass.get(controller);

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
