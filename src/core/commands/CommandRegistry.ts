import { asClass, type AwilixContainer } from 'awilix';
import { discoverModuleExports } from '@/app/bootstrap/module-discovery';
import { resolveScopedRegistration } from '@/app/bootstrap/scoped-resolution';
import { CommandError } from '@/core/commands/CommandError';
import { getCommandGroupMetadata, type CommandMethodMetadata } from '@/core/commands/decorators';
import { logger } from '@/core/logger';
import type { ReverseChannelBridge } from '@/modules/container/infrastructure/reverse-channel/ReverseChannelBridge';

export type CommandPayload = object | undefined;

export interface CommandResult {
    status?: number;
    data?: object | null;
    body?: Buffer;
    headers?: Record<string, string>;
    stream?: ReadableStream<Uint8Array>;
}

type RegisteredCommand = (payload: CommandPayload) => Promise<CommandResult>;

interface CommandGroupClass {
    new (...args: readonly unknown[]): object;
}

interface DiscoveredCommandGroup {
    readonly registrationName: string;
    readonly Group: CommandGroupClass;
    readonly namespace: string;
    readonly commands: readonly CommandMethodMetadata[];
}

const COMMAND_FILE_PATTERN = /Commands\.(cjs|cts|js|ts)$/;
const COMMAND_ROOTS = [
    'core/runtime/application/commands',
    'modules/analysis/application/commands',
    'modules/container/application/commands',
    'modules/jobs/application/commands',
    'modules/notebook/application/commands',
    'modules/plugin/application/commands',
    'modules/trajectory/application/commands'
];

const buildCommandName = (namespace: string, name: string): string => {
    return `${namespace}.${name}`;
};

const normalizeCommandResult = (
    result: unknown,
    command: CommandMethodMetadata
): CommandResult => {
    if (command.options.raw === true) {
        return result as CommandResult;
    }

    return {
        status: command.options.status,
        data: (result ?? null) as CommandResult['data']
    };
};

const discoverCommandGroups = (): Promise<DiscoveredCommandGroup[]> => {
    return discoverModuleExports<DiscoveredCommandGroup>({
        filePattern: COMMAND_FILE_PATTERN,
        roots: COMMAND_ROOTS,
        mapExport: ({ exportName, relativePath }, exportedValue) => {
            const metadata = getCommandGroupMetadata(exportedValue);

            if (!metadata) {
                return null;
            }

            return {
                registrationName: `command-group:${relativePath}.${exportName}`,
                Group: exportedValue as CommandGroupClass,
                namespace: metadata.namespace,
                commands: metadata.commands
            };
        }
    });
};

export class CommandRegistry {
    private readonly handlers = new Map<string, RegisteredCommand>();

    async registerDecoratedGroups(
        container: AwilixContainer,
        reverseChannelBridge: ReverseChannelBridge
    ): Promise<void> {
        logger.info('@command-registry: Registering cluster daemon commands');

        for (const commandGroup of await discoverCommandGroups()) {
            container.register({
                [commandGroup.registrationName]: asClass(commandGroup.Group).scoped()
            });

            for (const command of commandGroup.commands) {
                this.register(
                    buildCommandName(commandGroup.namespace, command.name),
                    async (payload) => {
                        const commandGroupInstance = resolveScopedRegistration<Record<string, (payload: CommandPayload) => unknown>>(
                            container,
                            commandGroup.registrationName,
                            {}
                        );
                        const result = await commandGroupInstance[command.propertyKey](payload);

                        return normalizeCommandResult(result, command);
                    }
                );
            }
        }

        for (const commandName of this.getCommandNames()) {
            reverseChannelBridge.registerCommand(commandName, (payload) => {
                return this.dispatch(commandName, payload);
            });
        }

        logger.info('@command-registry: Cluster daemon commands registered');
    }

    async dispatch(commandName: string, payload: CommandPayload): Promise<CommandResult> {
        const handler = this.handlers.get(commandName);
        if (!handler) {
            throw CommandError.notFound(
                'COMMAND_NOT_REGISTERED',
                `Command not registered: ${commandName}`
            );
        }

        return handler(payload);
    }

    getCommandNames(): string[] {
        return [...this.handlers.keys()];
    }

    private register(commandName: string, handler: RegisteredCommand): void {
        if (this.handlers.has(commandName)) {
            throw new Error(`Command already registered: ${commandName}`);
        }

        this.handlers.set(commandName, handler);
    }
}
