const EVENT_GROUP_NAMESPACE = Symbol('event-group-namespace');
const EVENT_GROUP_METHODS = Symbol('event-group-methods');

export interface EventMethodMetadata {
    readonly name: string;
    readonly propertyKey: string;
}

export interface EventGroupMetadata {
    readonly namespace: string;
    readonly events: readonly EventMethodMetadata[];
}

interface DecoratedEventGroupClass {
    new (...args: readonly unknown[]): object;
    [EVENT_GROUP_NAMESPACE]?: string;
    [EVENT_GROUP_METHODS]?: EventMethodMetadata[];
}

const getEventMethods = (target: DecoratedEventGroupClass): EventMethodMetadata[] => {
    if (!target[EVENT_GROUP_METHODS]) {
        target[EVENT_GROUP_METHODS] = [];
    }

    return target[EVENT_GROUP_METHODS]!;
};

export const EventGroup = (namespace: string): ClassDecorator => {
    return (target) => {
        (target as DecoratedEventGroupClass)[EVENT_GROUP_NAMESPACE] = namespace;
    };
};

export const OnEvent = (name: string): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        if (typeof descriptor?.value !== 'function') {
            throw new Error(`@OnEvent can only decorate methods: ${String(propertyKey)}`);
        }

        const eventGroupClass = (target as { constructor: DecoratedEventGroupClass }).constructor;
        getEventMethods(eventGroupClass).push({
            name,
            propertyKey: String(propertyKey)
        });
    };
};

export const getEventGroupMetadata = (value: unknown): EventGroupMetadata | null => {
    if (typeof value !== 'function') {
        return null;
    }

    const eventGroupClass = value as DecoratedEventGroupClass;
    const namespace = eventGroupClass[EVENT_GROUP_NAMESPACE];
    const events = eventGroupClass[EVENT_GROUP_METHODS];

    if (!namespace || !events?.length) {
        return null;
    }

    return {
        namespace,
        events: [...events]
    };
};
