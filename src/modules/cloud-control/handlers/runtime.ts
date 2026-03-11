import type { DaemonConfig } from '@/core/config';
import type { DockerRuntimeService } from '@/modules/platform/services';
import type { HostShellService } from '@/modules/platform/services';
import type { RuntimeEventBroker } from '@/shared/services';
import type { ReverseChannelCommandHandler } from '../services';
import fs from 'node:fs/promises';
import path from 'node:path';

interface RuntimeHandlersDependencies {
    config: DaemonConfig;
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    hostShellService: HostShellService;
    /**
     * Called after the update ack when async update work fails so the server
     * can transition the cluster to `UpdateFailed`.
     */
    reportUpdateFailed: (details: string) => Promise<void>;
}

interface UpdatePayload {
    targetImage: string;
    targetVersion: string;
};

const isUpdatePayload = (value: unknown): value is UpdatePayload => {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as Record<string, unknown>).targetImage === 'string' &&
        typeof (value as Record<string, unknown>).targetVersion === 'string'
    );
};

/**
 * Replaces or appends a KEY=VALUE line in an .env file content string.
 */
const setEnvValue = (content: string, key: string, value: string): string => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
    }

    const trailing = content.endsWith('\n') ? '' : '\n';
    return `${content}${trailing}${key}=${value}\n`;
};

export const createRuntimeHandlers = (deps: RuntimeHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'runtime.uninstall',
        execute: async () => {
            deps.eventBroker.emitLifecycle({
                type: 'uninstall-requested',
                teamClusterId: deps.config.teamClusterId,
                timestamp: new Date().toISOString(),
                connectedToCloud: true,
                details: 'Remote uninstall requested'
            });

            setTimeout(async () => {
                try {
                    if (deps.config.composeProjectName) {
                        await deps.dockerRuntimeService.removeComposeProject(deps.config.composeProjectName);
                    }

                    if (deps.config.installRoot) {
                        const installDirectory = path.join(deps.config.installRoot, deps.config.teamClusterId);
                        await fs.rm(installDirectory, {
                            recursive: true,
                            force: true
                        });
                    }

                    process.exit(0);
                } catch {
                }
            }, 250);

            return { data: { accepted: true } };
        }
    },
    {
        command: 'runtime.update',
        execute: async (payload) => {
            const distributionMode = process.env.TEAM_CLUSTER_DAEMON_DISTRIBUTION_MODE?.trim().toLowerCase();
            if (distributionMode === 'build') {
                return {
                    data: { accepted: false },
                    error: 'Update via runtime.update is only supported for image distribution mode. Build mode clusters must be updated manually.'
                };
            }

            if (!isUpdatePayload(payload)) {
                return {
                    data: { accepted: false },
                    error: 'Invalid update payload: targetImage and targetVersion are required.'
                };
            }

            deps.eventBroker.emitLifecycle({
                type: 'update-requested',
                teamClusterId: deps.config.teamClusterId,
                timestamp: new Date().toISOString(),
                connectedToCloud: true,
                details: `Updating daemon to ${payload.targetVersion}`
            });

            // Ack immediately - pull, .env write, and restart happen in deferred
            // async work so the reverse-channel response is never blocked by the
            // pull duration and cannot time out the 30-second server window.
            const capturedPayload = payload;
            setTimeout(async () => {
                try {
                    await deps.dockerRuntimeService.forcePullImage(capturedPayload.targetImage);
                } catch (pullError: unknown) {
                    const message = pullError instanceof Error ? pullError.message : String(pullError);
                    deps.eventBroker.emitLifecycle({
                        type: 'update-failed',
                        teamClusterId: deps.config.teamClusterId,
                        timestamp: new Date().toISOString(),
                        connectedToCloud: true,
                        details: `Image pull failed: ${message}`
                    });
                    deps.reportUpdateFailed(`Image pull failed: ${message}`).catch(() => {});
                    return;
                }

                if (deps.config.installRoot) {
                    try {
                        const installDirectory = path.join(deps.config.installRoot, deps.config.teamClusterId);
                        const envFilePath = path.join(installDirectory, '.env');
                        let envContent = await fs.readFile(envFilePath, 'utf-8');
                        envContent = setEnvValue(envContent, 'VOLT_CLUSTER_INSTALL_MANIFEST_VERSION', capturedPayload.targetVersion);
                        envContent = setEnvValue(envContent, 'VOLT_CLUSTER_DAEMON_IMAGE', capturedPayload.targetImage);
                        await fs.writeFile(envFilePath, envContent, 'utf-8');
                    } catch (envError: unknown) {
                        const message = envError instanceof Error ? envError.message : String(envError);
                        deps.eventBroker.emitLifecycle({
                            type: 'update-failed',
                            teamClusterId: deps.config.teamClusterId,
                            timestamp: new Date().toISOString(),
                            connectedToCloud: true,
                            details: `Failed to update .env: ${message}`
                        });
                        deps.reportUpdateFailed(`Failed to update .env: ${message}`).catch(() => {});
                        return;
                    }
                }

                if (!deps.config.installRoot) {
                    return;
                }

                try {
                    const installDirectory = path.join(deps.config.installRoot, deps.config.teamClusterId);
                    await deps.hostShellService.exec(
                        `cd "${installDirectory}" && docker compose up -d --no-deps --pull never daemon`
                    );
                } catch {
                    // The compose restart replaces this process; an error here is expected.
                }
            }, 250);

            return { data: { accepted: true } };
        }
    }
];
