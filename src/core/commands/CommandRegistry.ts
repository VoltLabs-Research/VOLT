import type { AwilixContainer } from 'awilix';
import {
    getCommandGroupMetadata,
    getRegisteredCommandGroups,
    type CommandMethodMetadata
} from '@/core/commands/decorators';
import { registerDecoratedGroupsOnContainer } from '@/core/decorators/register-decorated-groups-on-container';
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

        registerDecoratedGroupsOnContainer<CommandMethodMetadata>({
            kind: 'command-group',
            container,
            groups: getRegisteredCommandGroups(),
            getMetadata: (Group) => {
                const metadata = getCommandGroupMetadata(Group);
                if (!metadata) {
                    return null;
                }

                return {
                    namespace: metadata.namespace,
                    methods: metadata.commands
                };
            },
            onMethod: ({ namespace, method, resolveInstance }) => {
                const commandName = `${namespace}.${method.name}`;
                this.register(commandName, async (payload) => {
                    const instance = resolveInstance() as Record<string, (payload: CommandPayload) => unknown>;
                    const result = await instance[method.propertyKey](payload);
                    return this.normalizeCommandResult(result, method);
                });
            }
        });

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
