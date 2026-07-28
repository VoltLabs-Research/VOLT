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

export type CommandGroupClass = new (...args: any[]) => any;

const registeredGroups = new Set<CommandGroupClass>();
const namespaces = new WeakMap<CommandGroupClass, string>();
const commandsByGroup = new WeakMap<CommandGroupClass, CommandMethodMetadata[]>();

export const CommandGroup = (namespace: string): ClassDecorator => (target) => {
    const groupClass = target as unknown as CommandGroupClass;
    registeredGroups.add(groupClass);
    namespaces.set(groupClass, namespace);
};

export const Command = (name: string, options: CommandOptions = {}): MethodDecorator => (target, propertyKey, descriptor) => {
    if (typeof descriptor?.value !== 'function') {
        throw new Error(`@Command can only decorate methods: ${String(propertyKey)}`);
    }

    const groupClass = (target as { constructor: CommandGroupClass }).constructor;
    const methods = commandsByGroup.get(groupClass) ?? [];
    methods.push({ name, options, propertyKey: String(propertyKey) });
    commandsByGroup.set(groupClass, methods);
};

export const getCommandGroupMetadata = (value: unknown): CommandGroupMetadata | null => {
    if (typeof value !== 'function') {
        return null;
    }

    const groupClass = value as CommandGroupClass;
    const namespace = namespaces.get(groupClass);
    const commands = commandsByGroup.get(groupClass);

    if (!namespace || !commands?.length) {
        return null;
    }

    return { namespace, commands: [...commands] };
};

export const getRegisteredCommandGroups = (): readonly CommandGroupClass[] => [...registeredGroups];
