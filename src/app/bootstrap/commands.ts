import { asClass, type AwilixContainer } from 'awilix';
import type { ICommand } from '@/core/commands/ICommand';
import type { ICommandBus, CommandPayload, CommandResult } from '@/core/commands/ICommandBus';
import { logger } from '@/core/logger';
import type { ReverseChannelSocketBridge } from '@/modules/container/infrastructure/reverse-channel/ReverseChannelSocketBridge';
import { discoverModuleExports } from '@/app/bootstrap/module-discovery';
import { resolveScopedRegistration } from '@/app/bootstrap/scoped-resolution';
import { createAnalysisHandlers } from '@/modules/analysis/api/handlers/analysis';
import { createDebugHandlers } from '@/modules/analysis/api/handlers/debug';
import { createContainerHandlers } from '@/modules/container/api/handlers/container';
import { createRemoteAccessHandlers } from '@/modules/container/api/handlers/remote-access';
import { createJobHandlers } from '@/modules/jobs/api/handlers/jobs';
import { createNotebookHandlers } from '@/modules/notebook/api/handlers/notebook';
import { createPluginHandlers } from '@/modules/plugin/api/handlers/plugin';
import { createTrajectoryHandlers } from '@/modules/trajectory/api/handlers/trajectory';
import type { ReverseChannelCommandHandler } from '@/core/reverse-channel/contracts/commandHandler';

interface CommandClass {
    readonly commandName: string;
    readonly prototype: ICommand<CommandResult>;
    new (payload: CommandPayload): ICommand<CommandResult>;
}

const COMMAND_FILE_PATTERN = /Command\.(cjs|cts|js|ts)$/;
const COMMAND_ROOTS = [
    'core/runtime/application/commands',
    'modules/analysis/application/commands',
    'modules/container/application/commands',
    'modules/jobs/application/commands',
    'modules/notebook/application/commands',
    'modules/plugin/application/commands',
    'modules/trajectory/application/commands'
];

const isCommandClass = (value: unknown): value is CommandClass => {
    if (typeof value !== 'function') {
        return false;
    }

    const candidate = value as CommandClass;

    return typeof candidate.commandName === 'string'
        && typeof candidate.prototype?.execute === 'function';
};

const discoverCommands = (): Promise<CommandClass[]> => {
    return discoverModuleExports<CommandClass>({
        filePattern: COMMAND_FILE_PATTERN,
        roots: COMMAND_ROOTS,
        mapExport: (_context, exportedValue) => {
            return isCommandClass(exportedValue)
                ? exportedValue
                : null;
        }
    });
};

const registerLegacyReverseChannelHandlers = (
    container: AwilixContainer,
    reverseChannelSocketBridge: ReverseChannelSocketBridge
): void => {
    const handlers: ReverseChannelCommandHandler[] = [
        ...createAnalysisHandlers({
            analysisDispatchService: container.resolve('analysisDispatchService'),
            runtimeCapabilityGuard: container.resolve('runtimeCapabilityGuard')
        }),
        ...createDebugHandlers({
            debugSessionManager: container.resolve('debugSessionManager')
        }),
        ...createJobHandlers({
            queueService: container.resolve('queueService'),
            redisConnectionService: container.resolve('redisConnectionService')
        }),
        ...createTrajectoryHandlers({
            objectStore: container.resolve('objectStore'),
            queueService: container.resolve('queueService'),
            trajectoryAutoPreviewClaimStore: container.resolve('trajectoryAutoPreviewClaimStore'),
            trajectoryParserService: container.resolve('trajectoryParserService'),
            trajectoryPluginParserService: container.resolve('trajectoryPluginParserService'),
            glbExporterService: container.resolve('glbExporterService'),
            filterEvaluatorService: container.resolve('filterEvaluatorService'),
            runtimeCapabilityGuard: container.resolve('runtimeCapabilityGuard')
        }),
        ...createPluginHandlers({
            objectStore: container.resolve('objectStore'),
            pluginListingRepository: container.resolve('pluginListingRepository'),
            runtimeCapabilityGuard: container.resolve('runtimeCapabilityGuard')
        }),
        ...createContainerHandlers({
            dockerRuntimeService: container.resolve('dockerRuntimeService')
        }),
        ...createRemoteAccessHandlers({
            minioService: container.resolve('minioService'),
            redisExplorerReadService: container.resolve('redisExplorerReadService')
        }),
        ...createNotebookHandlers({
            jupyterRuntimeService: container.resolve('jupyterRuntimeService')
        })
    ];

    for (const handler of handlers) {
        reverseChannelSocketBridge.registerCommand(handler.command, handler.execute);
    }
};

export const registerDaemonCommands = async (
    container: AwilixContainer,
    commandBus: ICommandBus,
    reverseChannelSocketBridge: ReverseChannelSocketBridge
): Promise<void> => {
    logger.info('@command-bus: Registering cluster daemon commands');

    for (const Command of await discoverCommands()) {
        const registrationName = `command:${Command.commandName}`;

        container.register({
            [registrationName]: asClass(Command).scoped()
        });

        await commandBus.register({
            commandName: Command.commandName,
            createCommand: (payload) => {
                return resolveScopedRegistration<ICommand<CommandResult>>(
                    container,
                    registrationName,
                    { payload }
                );
            }
        });
    }

    for (const commandName of commandBus.getCommandNames()) {
        reverseChannelSocketBridge.registerCommand(commandName, (payload) => {
            return commandBus.dispatch(commandName, payload);
        });
    }

    registerLegacyReverseChannelHandlers(container, reverseChannelSocketBridge);

    logger.info('@command-bus: Cluster daemon commands registered');
};
