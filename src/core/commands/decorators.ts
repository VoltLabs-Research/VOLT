const COMMAND_GROUP_NAMESPACE = Symbol('command-group-namespace');
const COMMAND_GROUP_METHODS = Symbol('command-group-methods');

export interface CommandOptions {
    readonly raw?: boolean;
    readonly status?: number;
}

export interface CommandMethodMetadata {
    readonly name: string;
    readonly options: CommandOptions;
    readonly propertyKey: string;
}

export interface CommandGroupMetadata {
    readonly namespace: string;
    readonly commands: readonly CommandMethodMetadata[];
}

interface DecoratedCommandGroupClass {
    new (...args: readonly unknown[]): object;
    [COMMAND_GROUP_NAMESPACE]?: string;
    [COMMAND_GROUP_METHODS]?: CommandMethodMetadata[];
}

const getCommandMethods = (target: DecoratedCommandGroupClass): CommandMethodMetadata[] => {
    if (!target[COMMAND_GROUP_METHODS]) {
        target[COMMAND_GROUP_METHODS] = [];
    }

    return target[COMMAND_GROUP_METHODS]!;
};

export const CommandGroup = (namespace: string): ClassDecorator => {
    return (target) => {
        (target as DecoratedCommandGroupClass)[COMMAND_GROUP_NAMESPACE] = namespace;
    };
};

export const Command = (name: string, options: CommandOptions = {}): MethodDecorator => {
    return (target, propertyKey, descriptor) => {
        if (typeof descriptor?.value !== 'function') {
            throw new Error(`@Command can only decorate methods: ${String(propertyKey)}`);
        }

        const commandGroupClass = (target as { constructor: DecoratedCommandGroupClass }).constructor;
        getCommandMethods(commandGroupClass).push({
            name,
            options,
            propertyKey: String(propertyKey)
        });
    };
};

export const getCommandGroupMetadata = (value: unknown): CommandGroupMetadata | null => {
    if (typeof value !== 'function') {
        return null;
    }

    const commandGroupClass = value as DecoratedCommandGroupClass;
    const namespace = commandGroupClass[COMMAND_GROUP_NAMESPACE];
    const commands = commandGroupClass[COMMAND_GROUP_METHODS];

    if (!namespace || !commands?.length) {
        return null;
    }

    return {
        namespace,
        commands: [...commands]
    };
};
