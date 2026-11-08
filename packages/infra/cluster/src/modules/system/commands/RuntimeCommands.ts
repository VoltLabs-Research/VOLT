import { errorMessage } from '@shared/utilities/error-message';
import { getRuntimeRoleCoordinator } from '@core/bootstrap/RuntimeRoleCoordinator';
import { getConfig } from '@core/config/daemon';
import { getDockerRuntime } from '@shared/runtime/DockerRuntime';
import { getVoltCloudConnection } from '@modules/system/socket/connection/VoltCloudConnection';
import { getQueueService } from '@shared/queues/QueueService';
import * as path from 'node:path';
import { safeRemovePath } from '@shared/utilities/safe-remove-path';
import type { RuntimeRoleCoordinator } from '@core/bootstrap/RuntimeRoleCoordinator';
import type { DaemonConfig } from '@core/config/daemon';
import { Command, commandGroupFactory } from '@shared/commands/command';
import type { QueueService } from '@shared/queues/QueueService';
import type { DockerRuntime } from '@shared/runtime/DockerRuntime';
import type { VoltCloudConnection } from '@modules/system/socket/connection/VoltCloudConnection';
import type {
    TeamClusterDaemonQueueConcurrencyApplyPayload,
    TeamClusterDaemonQueueConcurrencyApplyResult,
    TeamClusterDaemonRoleApplyPayload,
    TeamClusterDaemonRoleApplyResult
} from '@voltstack/daemon-cluster-client';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import type { DaemonRuntimeUpdatePayload } from '@volt/contracts/modules/system/domain';
import { resolveInstallDir, startDaemonSelfUpdate } from '@modules/system/services/daemon-self-update';

const DEFERRED_RUNTIME_COMMAND_DELAY_MS = 250;

export class RuntimeCommands {
    constructor(
        private readonly runtimeRoleCoordinator: RuntimeRoleCoordinator,
        private readonly config: DaemonConfig,
        private readonly dockerRuntime: DockerRuntime,
        private readonly voltCloudConnection: VoltCloudConnection,
        private readonly queueService: QueueService
    ) {}

    @Command(DaemonCommand.RuntimeQueuesSnapshot)
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

    @Command(DaemonCommand.RuntimeQueueConcurrencyApply)
    applyQueueConcurrency(payload: TeamClusterDaemonQueueConcurrencyApplyPayload): TeamClusterDaemonQueueConcurrencyApplyResult {
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

    @Command(DaemonCommand.RuntimeRoleApply)
    async applyRole(payload: TeamClusterDaemonRoleApplyPayload): Promise<TeamClusterDaemonRoleApplyResult> {
        try {
            return await this.runtimeRoleCoordinator.applyRoleConfig(payload.roleConfig);
        } catch (error) {
            return {
                accepted: false,
                error: error instanceof Error ? error.message : 'Failed to apply runtime role'
            };
        }
    }

    @Command(DaemonCommand.RuntimeUninstall)
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
                const details = `Runtime uninstall failed: ${errorMessage(error)}`;

                await this.voltCloudConnection.reportDeleteFailed(details);
                process.exit(1);
            }
        }, DEFERRED_RUNTIME_COMMAND_DELAY_MS);

        return { accepted: true };
    }

    // Moves this cluster to the server's release. The update recreates this daemon's container, so
    // the command answers first and the new daemon reports the new version on its next heartbeat.
    @Command(DaemonCommand.RuntimeUpdate)
    async update(payload: DaemonRuntimeUpdatePayload) {
        if (!resolveInstallDir(this.config)) {
            return {
                accepted: false,
                reason: 'This cluster was not installed with install.sh, so it updates with the stack it belongs to.'
            };
        }

        try {
            await startDaemonSelfUpdate(this.config, payload);
            return { accepted: true };
        } catch (error) {
            return {
                accepted: false,
                reason: `Could not update to ${payload.version}: ${errorMessage(error)}`
            };
        }
    }
}

export const getRuntimeCommands = commandGroupFactory(RuntimeCommands, () => new RuntimeCommands(getRuntimeRoleCoordinator(), getConfig(), getDockerRuntime(), getVoltCloudConnection(), getQueueService()));
