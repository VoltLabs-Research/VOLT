import {
    createDecoratedGroupRegistry,
    type DecoratedGroupClass,
    type DecoratedGroupMetadata
} from '@/core/decorators/create-decorated-group-registry';

export interface NamespacedMethodDecorators<TMethod, TMethodArgs extends readonly unknown[]> {
    readonly Group: (namespace: string) => ClassDecorator;
    readonly Method: (...args: TMethodArgs) => MethodDecorator;
    readonly getMetadata: (value: unknown) => DecoratedGroupMetadata<TMethod> | null;
    readonly getRegisteredGroups: () => readonly DecoratedGroupClass[];
}

/**
 * Shared factory behind `@CommandGroup`/`@Command` and `@EventGroup`/`@OnEvent`.
 * Callers supply the decorator label and a `buildMethodMetadata` function that
 * receives the decoration-time `propertyKey` together with whatever arguments
 * the `@Method(...)` form accepts and returns the final method-level metadata.
 */
export const createNamespacedMethodDecorators = <TMethod, TMethodArgs extends readonly unknown[]>(opts: {
    readonly decoratorLabel: string;
    readonly buildMethodMetadata: (propertyKey: string, ...args: TMethodArgs) => TMethod;
}): NamespacedMethodDecorators<TMethod, TMethodArgs> => {
    const registry = createDecoratedGroupRegistry<TMethod>();

    const Group = (namespace: string): ClassDecorator => (target) => {
        registry.registerGroup(target as unknown as DecoratedGroupClass, namespace);
    };

    const Method = (...args: TMethodArgs): MethodDecorator => (target, propertyKey, descriptor) => {
        if (typeof descriptor?.value !== 'function') {
            throw new Error(`${opts.decoratorLabel} can only decorate methods: ${String(propertyKey)}`);
        }
        const groupClass = (target as { constructor: DecoratedGroupClass }).constructor;
        registry.registerMethod(groupClass, opts.buildMethodMetadata(String(propertyKey), ...args));
    };

    return {
        Group,
        Method,
        getMetadata: (value) => registry.getMetadata(value),
        getRegisteredGroups: () => registry.getRegisteredGroups()
    };
};
