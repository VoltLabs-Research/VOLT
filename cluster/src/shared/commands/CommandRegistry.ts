import {
    getCommandGroupMetadata,
    type CommandGroupFactory,
    type CommandMethodMetadata
} from '@shared/commands/command';
import { logger } from '@shared/infrastructure/logger';
import type { CommandTransport } from '@shared/contracts/channel/command-transport';

export interface CommandResult {
    status?: number;
    data?: object | null;
    body?: Buffer;
    headers?: Record<string, string>;
    stream?: ReadableStream<Uint8Array>;
}

const normalizeCommandResult = (result: unknown, command: CommandMethodMetadata): CommandResult => {
    if (command.options.raw === true) {
        return result as CommandResult;
    }

    return {
        status: command.options.status,
        data: (result ?? null) as CommandResult['data']
    };
};

export const registerCommandGroups = (
    factories: readonly CommandGroupFactory[],
    transport: CommandTransport
): void => {
    const commandNames = new Set<string>();

    for (const factory of factories) {
        const metadata = getCommandGroupMetadata(factory.group);
        if (!metadata) {
            throw new Error(`Command group "${factory.group.name}" is missing @CommandGroup metadata.`);
        }

        for (const method of metadata.commands) {
            const commandName = `${metadata.namespace}.${method.name}`;
            if (commandNames.has(commandName)) {
                throw new Error(`Command already registered: ${commandName}`);
            }
            commandNames.add(commandName);

            transport.registerCommand(commandName, async (payload) => {
                const result = await factory()[method.propertyKey](payload);
                return normalizeCommandResult(result, method);
            });
        }
    }

    logger.info(`@command-registry: registered ${commandNames.size} commands from ${factories.length} groups`);
};
