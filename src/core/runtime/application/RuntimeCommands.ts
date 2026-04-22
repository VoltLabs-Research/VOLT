import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { RuntimeRoleCoordinator } from '@/app/coordination/RuntimeRoleCoordinator';
import type { DaemonConfig } from '@/core/config';
import { Command, CommandGroup } from '@/core/commands/decorators';
import type {
    TeamClusterDaemonQueueConcurrencyApplyPayload,
    TeamClusterDaemonRoleApplyPayload
} from '@/core/runtime/contracts/team-cluster-runtime';
import type { DockerRuntime } from '@/core/runtime/infrastructure/DockerRuntime';
import type { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';

const DEFERRED_RUNTIME_COMMAND_DELAY_MS = 250;

@CommandGroup('runtime')
export class RuntimeCommands {
    constructor(
        private readonly runtimeRoleCoordinator: RuntimeRoleCoordinator,
        private readonly config: DaemonConfig,
        private readonly dockerRuntime: DockerRuntime,
        private readonly voltCloudConnection: VoltCloudConnection
    ) {}

    @Command('restart')
    restart() {
        setTimeout(() => {
            process.exit(0);
        }, DEFERRED_RUNTIME_COMMAND_DELAY_MS);

        return { accepted: true };
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
                    await fs.rm(path.join(this.config.installRoot, this.config.teamClusterId), {
                        recursive: true,
                        force: true
                    });
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
