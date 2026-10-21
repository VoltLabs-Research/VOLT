import type { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';

interface CommandOptions {
    readonly raw?: boolean;
    readonly status?: number;
}

export interface CommandMethodMetadata {
    readonly name: DaemonCommand;
    readonly options: CommandOptions;
    readonly propertyKey: string;
}

type CommandGroupClass = new (...args: never[]) => object;

type CommandPayload = object | undefined;

type CommandHandlerMap = Record<string, (payload: CommandPayload) => unknown>;

export interface CommandGroupFactory {
    (): CommandHandlerMap;
    readonly group: CommandGroupClass;
}

const commandsByGroup = new WeakMap<CommandGroupClass, CommandMethodMetadata[]>();

export const Command = (name: DaemonCommand, options: CommandOptions = {}): MethodDecorator => (target, propertyKey, descriptor) => {
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

export const getGroupCommands = (group: CommandGroupClass): readonly CommandMethodMetadata[] => (
    commandsByGroup.get(group) ?? []
);

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
