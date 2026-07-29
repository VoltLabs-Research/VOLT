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

export type CommandGroupClass = new (...args: never[]) => object;

export type CommandPayload = object | undefined;

export type CommandHandlerMap = Record<string, (payload: CommandPayload) => unknown>;

export interface CommandGroupFactory {
    (): CommandHandlerMap;
    readonly group: CommandGroupClass;
}

const namespaces = new WeakMap<CommandGroupClass, string>();
const commandsByGroup = new WeakMap<CommandGroupClass, CommandMethodMetadata[]>();

export const CommandGroup = (namespace: string): ClassDecorator => (target) => {
    namespaces.set(target as unknown as CommandGroupClass, namespace);
};

export const Command = (name: string, options: CommandOptions = {}): MethodDecorator => (target, propertyKey, descriptor) => {
    if (typeof descriptor?.value !== 'function') {
        throw new Error(`@Command can only decorate methods: ${String(propertyKey)}`);
    }

    const groupClass = (target as { constructor: CommandGroupClass }).constructor;
    const methods = commandsByGroup.get(groupClass) ?? [];
    methods.push({
        name,
        options,
        propertyKey: String(propertyKey)
    });
    commandsByGroup.set(groupClass, methods);
};

export const getCommandGroupMetadata = (group: CommandGroupClass): CommandGroupMetadata | null => {
    const namespace = namespaces.get(group);
    const commands = commandsByGroup.get(group);

    if (!namespace || !commands?.length) {
        return null;
    }

    return {
        namespace,
        commands: [...commands]
    };
};

export const commandGroupFactory = <TGroup extends object>(
    group: new (...args: never[]) => TGroup,
    create: () => TGroup
): CommandGroupFactory => {
    let instance: TGroup | null = null;

    const factory = (): CommandHandlerMap => {
        instance ??= create();
        return instance as unknown as CommandHandlerMap;
    };

    return Object.assign(factory, { group: group as CommandGroupClass });
};
