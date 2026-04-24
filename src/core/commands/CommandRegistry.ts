import { asClass, type AwilixContainer } from 'awilix';
import {
    getCommandGroupMetadata,
    getRegisteredCommandGroups,
    type CommandGroupClass,
    type CommandMethodMetadata
} from '@/core/commands/decorators';
import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import ApplicationError from '@/app/coordination/ApplicationError';
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

@Service('commandRegistry')
export class CommandRegistry {
    private readonly handlers = new Map<string, RegisteredCommand>();
    private readyResolve: (() => void) | null = null;
    private readonly readyPromise: Promise<void> = new Promise((resolve) => { this.readyResolve = resolve; });
    private ready = false;

    async registerDecoratedGroups(
        container: AwilixContainer,
        reverseChannelBridge: ReverseChannelBridge
    ): Promise<void> {
        logger.info('@command-registry: registering cluster daemon commands');

        const registrationNames = new Set<string>();

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
                this.register(commandName, async (payload) => {
                    const instance = container.resolve<Record<string, (payload: CommandPayload) => unknown>>(registrationName);
                    const result = await instance[method.propertyKey](payload);
                    return this.normalizeCommandResult(result, method);
                });
            }
        }

        for (const name of this.handlers.keys()) {
            reverseChannelBridge.registerCommand(name, (payload) => this.dispatch(name, payload));
        }

        logger.info('@command-registry: Cluster daemon commands registered');
    }

    markReady(): void {
        if (this.ready) return;
        this.ready = true;
        this.readyResolve?.();
    }

    async dispatch(commandName: string, payload: CommandPayload): Promise<CommandResult> {
        if (!this.ready) {
            await this.readyPromise;
        }

        const handler = this.handlers.get(commandName);
        if (!handler) {
            throw ApplicationError.notFound(
                'COMMAND_NOT_REGISTERED',
                `Command not registered: ${commandName}`
            );
        }

        return handler(payload);
    }

    private register(commandName: string, handler: RegisteredCommand): void {
        if (this.handlers.has(commandName)) {
            throw new Error(`Command already registered: ${commandName}`);
        }

        this.handlers.set(commandName, handler);
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
