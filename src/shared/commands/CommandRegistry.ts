import {
    getCommandGroupMetadata,
    type CommandGroupClass,
    type CommandMethodMetadata
} from '@shared/commands/command';
import { logger } from '@shared/infrastructure/logger';
import type { ReverseChannelBridge } from '@modules/container/socket/ReverseChannelBridge';

export type CommandPayload = object | undefined;

export interface CommandResult {
    status?: number;
    data?: object | null;
    body?: Buffer;
    headers?: Record<string, string>;
    stream?: ReadableStream<Uint8Array>;
}

export interface CommandGroupBinding {
    moduleKey: string;
    group: CommandGroupClass;
    resolve: () => Record<string, (payload: CommandPayload) => unknown>;
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

export class CommandRegistry {
    registerGroups(
        bindings: readonly CommandGroupBinding[],
        reverseChannelBridge: ReverseChannelBridge
    ): void {
        const commandNames = new Set<string>();
        let groups = 0;

        for (const { group, resolve } of bindings) {
            const metadata = getCommandGroupMetadata(group);
            if (!metadata) {
                throw new Error(`Command group "${(group as CommandGroupClass & { name: string }).name}" is missing @CommandGroup metadata.`);
            }

            groups += 1;

            for (const method of metadata.commands) {
                const commandName = `${metadata.namespace}.${method.name}`;
                if (commandNames.has(commandName)) {
                    throw new Error(`Command already registered: ${commandName}`);
                }
                commandNames.add(commandName);

                reverseChannelBridge.registerCommand(commandName, async (payload) => {
                    const result = await resolve()[method.propertyKey](payload);
                    return normalizeCommandResult(result, method);
                });
            }
        }

        logger.info(`@command-registry: registered ${commandNames.size} commands from ${groups}/${bindings.length} groups`);
    }
}

let commandRegistryInstance: CommandRegistry | null = null;

export const getCommandRegistry = (): CommandRegistry => {
    commandRegistryInstance ??= new CommandRegistry();
    return commandRegistryInstance;
};
