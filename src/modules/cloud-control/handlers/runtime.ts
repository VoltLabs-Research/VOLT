import { readPayloadRecord, readString } from './payloadValidation';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DaemonConfig } from '@/core/config';
import type { DockerRuntimeService, HostShellService } from '@/modules/platform/services';
import type { RuntimeLifecycleEventType } from '@voltstack/daemon-cluster-client';
import type { ReverseChannelCommandHandler } from '../services';

interface RuntimeHandlersDependencies {
    config: DaemonConfig;
    dockerRuntimeService: DockerRuntimeService;
    hostShellService: HostShellService;
    emitLifecycle: (type: RuntimeLifecycleEventType, details?: string) => void;
    /**
     * Called after the update ack when async update work fails so the server
     * can transition the cluster to `UpdateFailed`.
     */
    reportUpdateFailed: (details: string) => Promise<void>;
    reportDeleteFailed: (details: string) => Promise<void>;
};

interface UpdatePayload {
    targetImage: string;
    targetVersion: string;
};

enum RuntimeEnvironmentKey {
    InstallManifestVersion = 'VOLT_CLUSTER_INSTALL_MANIFEST_VERSION',
    DaemonImage = 'VOLT_CLUSTER_DAEMON_IMAGE'
}

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

const readUpdatePayload = (payload: unknown): UpdatePayload => {
    const record = readPayloadRecord(payload);

    return {
        targetImage: readString(record.targetImage, 'targetImage'),
        targetVersion: readString(record.targetVersion, 'targetVersion')
    };
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

const reportDeferredUpdateFailure = (deps: RuntimeHandlersDependencies, details: string): void => {
    deps.emitLifecycle('update-failed', details);
    deps.reportUpdateFailed(details).catch(() => {});
};

const deferRuntimeCommand = (operation: () => Promise<void>): void => {
    setTimeout(() => {
        operation().catch(() => {});
    }, DEFERRED_RUNTIME_COMMAND_DELAY_MS);
};

const updateRuntimeManifest = async (installDirectory: string, payload: UpdatePayload): Promise<void> => {
    const envFilePath = path.join(installDirectory, '.env');
    let envContent = await fs.readFile(envFilePath, 'utf-8');

    envContent = setEnvValue(envContent, RuntimeEnvironmentKey.InstallManifestVersion, payload.targetVersion);
    envContent = setEnvValue(envContent, RuntimeEnvironmentKey.DaemonImage, payload.targetImage);

    await fs.writeFile(envFilePath, envContent, 'utf-8');
};

const restartRuntime = async (deps: RuntimeHandlersDependencies, installDirectory: string): Promise<void> => {
    await deps.hostShellService.exec(
        `cd "${installDirectory}" && docker compose up -d --no-deps --pull never daemon`
    );
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

        // @ts-expect-error preserve legacy delete lifecycle contract for uninstall failures
        deps.emitLifecycle('delete-failed', details);
        await deps.reportDeleteFailed(details);
        process.exit(1);
    }
};

const executeRuntimeUpdate = async (deps: RuntimeHandlersDependencies, payload: UpdatePayload): Promise<void> => {
    try {
        await deps.dockerRuntimeService.forcePullImage(payload.targetImage);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        reportDeferredUpdateFailure(deps, `Image pull failed: ${message}`);
        return;
    }

    const installDirectory = getInstallDirectory(deps.config);
    if (!installDirectory) {
        return;
    }

    try {
        await updateRuntimeManifest(installDirectory, payload);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        reportDeferredUpdateFailure(deps, `Failed to update .env: ${message}`);
        return;
    }

    try {
        await restartRuntime(deps, installDirectory);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        reportDeferredUpdateFailure(deps, `Failed to apply runtime update: ${message}`);
    }
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
        command: 'runtime.update',
        execute: async (payload) => {
            const distributionMode = process.env.TEAM_CLUSTER_DAEMON_DISTRIBUTION_MODE?.trim().toLowerCase();
            if (distributionMode === 'build') {
                return rejectRuntimeCommand(
                    'Update via runtime.update is only supported for image distribution mode. Build mode clusters must be updated manually.'
                );
            }

            let request: UpdatePayload;

            try {
                request = readUpdatePayload(payload);
            } catch {
                return rejectRuntimeCommand('Invalid update payload: targetImage and targetVersion are required.');
            }

            deps.emitLifecycle('update-requested', `Updating daemon to ${request.targetVersion}`);

            // Ack immediately - pull, .env write, and restart happen in deferred
            // async work so the reverse-channel response is never blocked by the
            // pull duration and cannot time out the 30-second server window.

            deferRuntimeCommand(() => executeRuntimeUpdate(deps, request));

            return acceptRuntimeCommand();
        }
    }
];
