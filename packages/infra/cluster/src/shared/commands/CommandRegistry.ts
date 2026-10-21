import {
    getGroupCommands,
    type CommandGroupFactory,
    type CommandMethodMetadata
} from '@shared/commands/command';
import { logger } from '@shared/logger';
import type { CommandTransport } from '@shared/contracts/channel/command-transport';
import type { ReverseChannelCommandResult } from '@shared/contracts/channel/reverse-channel-messaging';

const normalizeCommandResult = (result: unknown, command: CommandMethodMetadata): ReverseChannelCommandResult => {
    if (command.options.raw === true) {
        return result as ReverseChannelCommandResult;
    }

    return {
        status: command.options.status,
        data: (result ?? null) as ReverseChannelCommandResult['data']
    };
};

export const registerCommandGroups = (
    factories: readonly CommandGroupFactory[],
    transport: CommandTransport
): void => {
    const commandNames = new Set<string>();

    for (const factory of factories) {
        const commands = getGroupCommands(factory.group);
        if (commands.length === 0) {
            throw new Error(`Command group "${factory.group.name}" declares no @Command methods.`);
        }

        for (const method of commands) {
            const commandName = method.name;
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
