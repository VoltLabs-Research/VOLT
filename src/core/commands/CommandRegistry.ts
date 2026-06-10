import { asClass, type AwilixContainer } from 'awilix';
import {
    getCommandGroupMetadata,
    getRegisteredCommandGroups,
    type CommandGroupClass,
    type CommandMethodMetadata
} from '@/core/commands/decorators';
import { Service } from '@/core/decorators/service';
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

@Service('commandRegistry')
export class CommandRegistry {
    async registerDecoratedGroups(
        container: AwilixContainer,
        reverseChannelBridge: ReverseChannelBridge
    ): Promise<void> {
        logger.info('@command-registry: registering cluster daemon commands');

        const registrationNames = new Set<string>();
        const commandNames = new Set<string>();

        for (const Group of getRegisteredCommandGroups()) {
            const metadata = getCommandGroupMetadata(Group);
            if (!metadata) {
                continue;
            }

            const registrationName = `command-group:${metadata.namespace}.${(Group as CommandGroupClass & { name: string }).name}`;
            if (registrationNames.has(registrationName)) {
                throw new Error(`Duplicate command group registration: ${registrationName}`);
            }
            registrationNames.add(registrationName);

            container.register({
                [registrationName]: asClass(Group as unknown as new (...args: unknown[]) => Record<string, unknown>).singleton()
            });

            for (const method of metadata.commands) {
                const commandName = `${metadata.namespace}.${method.name}`;
                if (commandNames.has(commandName)) {
                    throw new Error(`Command already registered: ${commandName}`);
                }
                commandNames.add(commandName);

                reverseChannelBridge.registerCommand(commandName, async (payload) => {
                    const instance = container.resolve<Record<string, (payload: CommandPayload) => unknown>>(registrationName);
                    const result = await instance[method.propertyKey](payload);
                    return this.normalizeCommandResult(result, method);
                });
            }
        }

        logger.info('@command-registry: Cluster daemon commands registered');
    }

    private normalizeCommandResult(result: unknown, command: CommandMethodMetadata): CommandResult {
        if (command.options.raw === true) {
            return result as CommandResult;
        }

        return {
            status: command.options.status,
            data: (result ?? null) as CommandResult['data']
        };
    }
}
