import { ChannelCommands, type TeamClusterDaemonRoleApplyPayload, type TeamClusterDaemonRoleApplyResult, type TeamClusterDaemonQueueConcurrency, type TeamClusterDaemonQueueConcurrencyApplyPayload, type TeamClusterDaemonQueueScopeLimits } from '@/contracts';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DaemonConfig } from '@/core/config';
import type { DockerRuntimeService } from '@/core/runtime/infrastructure/DockerRuntimeService';
import type { RuntimeLifecycleEventType } from '@voltstack/daemon-cluster-client';
import type { ReverseChannelCommandHandler } from '@/core/reverse-channel/contracts/commandHandler';

interface RuntimeHandlersDependencies {
    config: DaemonConfig;
    dockerRuntimeService: DockerRuntimeService;
    emitLifecycle: (type: RuntimeLifecycleEventType, details?: string) => void;
    reportDeleteFailed: (details: string) => Promise<void>;
    applyQueueSettings: (
        queueConcurrency: TeamClusterDaemonQueueConcurrency,
        queueScopeLimits: TeamClusterDaemonQueueScopeLimits
    ) => void;
    applyRoleConfig: (payload: TeamClusterDaemonRoleApplyPayload['roleConfig']) => Promise<TeamClusterDaemonRoleApplyResult>;
};

const DEFERRED_RUNTIME_COMMAND_DELAY_MS = 250;

const rejectRuntimeCommand = (error: string) => {
    return {
        data: { accepted: false },
        error
    };
};

const acceptRuntimeCommand = () => {
    return { data: { accepted: true } };
};

const getInstallDirectory = (config: DaemonConfig): string | null => {
    if (!config.installRoot) {
        return null;
    }

    return path.join(config.installRoot, config.teamClusterId);
};

const deferRuntimeCommand = (operation: () => Promise<void>): void => {
    setTimeout(() => {
        operation().catch(() => {});
    }, DEFERRED_RUNTIME_COMMAND_DELAY_MS);
};

const executeRuntimeUninstall = async (deps: RuntimeHandlersDependencies): Promise<void> => {
    try {
        if (deps.config.composeProjectName) {
            await deps.dockerRuntimeService.removeComposeProject(deps.config.composeProjectName);
        }

        const installDirectory = getInstallDirectory(deps.config);
        if (installDirectory) {
            await fs.rm(installDirectory, {
                recursive: true,
                force: true
            });
        }

        process.exit(0);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const details = `Runtime uninstall failed: ${message}`;

        deps.emitLifecycle('delete-failed' as RuntimeLifecycleEventType, details);
        await deps.reportDeleteFailed(details);
        process.exit(1);
    }
};

const executeRuntimeRestart = async (): Promise<void> => {
    process.exit(0);
};

export const createRuntimeHandlers = (deps: RuntimeHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'runtime.uninstall',
        execute: async () => {
            deps.emitLifecycle('uninstall-requested', 'Remote uninstall requested');

            deferRuntimeCommand(() => executeRuntimeUninstall(deps));

            return acceptRuntimeCommand();
        }
    },
    {
        command: ChannelCommands.RuntimeRoleApply,
        execute: async (payload) => {
            const request = payload as TeamClusterDaemonRoleApplyPayload;

            try {
                const result = await deps.applyRoleConfig(request.roleConfig);
                return {
                    data: result
                };
            } catch (error: unknown) {
                return rejectRuntimeCommand(
                    error instanceof Error
                        ? error.message
                        : 'Failed to apply runtime role'
                );
            }
        }
    },
    {
        command: ChannelCommands.RuntimeQueueConcurrencyApply,
        execute: async (payload) => {
            const request = payload as TeamClusterDaemonQueueConcurrencyApplyPayload;

            try {
                deps.applyQueueSettings(request.queueConcurrency, request.queueScopeLimits);
            } catch (error: unknown) {
                return rejectRuntimeCommand(
                    error instanceof Error
                        ? error.message
                        : 'Failed to apply queue settings'
                );
            }

            return {
                data: {
                    accepted: true,
                    queueConcurrency: request.queueConcurrency,
                    queueScopeLimits: request.queueScopeLimits
                }
            };
        }
    },
    {
        command: ChannelCommands.RuntimeRestart,
        execute: async () => {
            deferRuntimeCommand(executeRuntimeRestart);

            return acceptRuntimeCommand();
        }
    }
];
