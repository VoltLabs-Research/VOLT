import { getRuntimeRoleCoordinator } from '@core/bootstrap/RuntimeRoleCoordinator';
import { getConfig } from '@core/config/daemon';
import { getDockerRuntime } from '@shared/infrastructure/runtime/DockerRuntime';
import { getVoltCloudConnection } from '@modules/container/socket/connection/VoltCloudConnection';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import * as path from 'node:path';
import { safeRemovePath } from '@shared/infrastructure/utilities/safe-remove-path';
import type { RuntimeRoleCoordinator } from '@core/bootstrap/RuntimeRoleCoordinator';
import type { DaemonConfig } from '@core/config/daemon';
import { Command, CommandGroup } from '@shared/commands/command';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import type {
    TeamClusterDaemonQueueConcurrencyApplyPayload,
    TeamClusterDaemonRoleApplyPayload
} from '@shared/contracts/types/team-cluster-runtime';
import type { DockerRuntime } from '@shared/infrastructure/runtime/DockerRuntime';
import type { VoltCloudConnection } from '@modules/container/socket/connection/VoltCloudConnection';

const DEFERRED_RUNTIME_COMMAND_DELAY_MS = 250;

@CommandGroup('runtime')
export class RuntimeCommands {
    constructor(
        private readonly runtimeRoleCoordinator: RuntimeRoleCoordinator,
        private readonly config: DaemonConfig,
        private readonly dockerRuntime: DockerRuntime,
        private readonly voltCloudConnection: VoltCloudConnection,
        private readonly queueService: QueueService
    ) {}

    @Command('restart')
    restart() {
        setTimeout(() => {
            process.exit(0);
        }, DEFERRED_RUNTIME_COMMAND_DELAY_MS);

        return { accepted: true };
    }

    @Command('queues.snapshot')
    async queuesSnapshot() {
        const queueNames = this.queueService.listKnownQueueNames();
        const entries = await Promise.all(queueNames.map(async (name) => ({
            name,
            counts: await this.queueService.getJobCounts(name)
        })));
        return {
            accepted: true,
            queues: entries,
            capturedAt: new Date().toISOString()
        };
    }

    @Command('queue-concurrency.apply')
    applyQueueConcurrency(payload: TeamClusterDaemonQueueConcurrencyApplyPayload) {
        try {
            this.runtimeRoleCoordinator.applyQueueSettings(
                payload.queueConcurrency,
                payload.queueScopeLimits
            );
        } catch (error) {
            return {
                accepted: false,
                error: error instanceof Error ? error.message : 'Failed to apply queue settings'
            };
        }

        return {
            accepted: true,
            queueConcurrency: payload.queueConcurrency,
            queueScopeLimits: payload.queueScopeLimits
        };
    }

    @Command('role.apply')
    async applyRole(payload: TeamClusterDaemonRoleApplyPayload) {
        try {
            return await this.runtimeRoleCoordinator.applyRoleConfig(payload.roleConfig);
        } catch (error) {
            return {
                accepted: false,
                error: error instanceof Error ? error.message : 'Failed to apply runtime role'
            };
        }
    }

    @Command('uninstall')
    uninstall() {
        setTimeout(async () => {
            try {
                if (this.config.composeProjectName) {
                    await this.dockerRuntime.removeComposeProject(this.config.composeProjectName);
                }

                if (this.config.installRoot) {
                    await safeRemovePath(
                        path.join(this.config.installRoot, this.config.teamClusterId),
                        { recursive: true }
                    );
                }

                process.exit(0);
            } catch (error) {
                const details = `Runtime uninstall failed: ${error instanceof Error ? error.message : String(error)}`;

                await this.voltCloudConnection.reportDeleteFailed(details);
                process.exit(1);
            }
        }, DEFERRED_RUNTIME_COMMAND_DELAY_MS);

        return { accepted: true };
    }
}

let RuntimeCommandsInstance: RuntimeCommands | null = null;

export const getRuntimeCommands = (): RuntimeCommands => {
    RuntimeCommandsInstance ??= new RuntimeCommands(getRuntimeRoleCoordinator(), getConfig(), getDockerRuntime(), getVoltCloudConnection(), getQueueService());
    return RuntimeCommandsInstance;
};
