import { readNumber, readPayloadRecord, readString } from './payloadValidation';
import {
    TEAM_CLUSTER_DAEMON_COMMAND,
    type TeamClusterDaemonRoleApplyPayload,
    type TeamClusterDaemonRoleApplyResult,
    type TeamClusterDaemonQueueConcurrency,
    type TeamClusterDaemonQueueConcurrencyApplyPayload,
    type TeamClusterRole
} from '@/shared/contracts';
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
    applyQueueConcurrency: (queueConcurrency: TeamClusterDaemonQueueConcurrency) => void;
    applyRoleConfig: (payload: TeamClusterDaemonRoleApplyPayload['roleConfig']) => Promise<TeamClusterDaemonRoleApplyResult>;
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

const readQueueConcurrencyValue = (value: unknown, fieldName: string): number => {
    const parsedValue = readNumber(value, fieldName);
    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
        throw new Error(`${fieldName} must be an integer greater than or equal to 1`);
    }

    return parsedValue;
};

const readQueueConcurrencyApplyPayload = (payload: unknown): TeamClusterDaemonQueueConcurrencyApplyPayload => {
    const record = readPayloadRecord(payload);
    const recordKeys = Object.keys(record).filter((key) => key !== 'metadata');
    if (recordKeys.length !== 1 || recordKeys[0] !== 'queueConcurrency') {
        throw new Error('payload must contain queueConcurrency only');
    }

    const queueConcurrencyRecord = readPayloadRecord(record.queueConcurrency);
    const queueConcurrencyKeys = Object.keys(queueConcurrencyRecord).sort();
    const expectedKeys = ['analysis', 'glbPreprocessing', 'rasterizer', 'sshImport'];

    if (queueConcurrencyKeys.length !== expectedKeys.length) {
        throw new Error('queueConcurrency must include analysis, rasterizer, glbPreprocessing, and sshImport');
    }

    for (const [index, key] of expectedKeys.entries()) {
        if (queueConcurrencyKeys[index] !== key) {
            throw new Error('queueConcurrency must include analysis, rasterizer, glbPreprocessing, and sshImport');
        }
    }

    return {
        queueConcurrency: {
            analysis: readQueueConcurrencyValue(queueConcurrencyRecord.analysis, 'queueConcurrency.analysis'),
            rasterizer: readQueueConcurrencyValue(queueConcurrencyRecord.rasterizer, 'queueConcurrency.rasterizer'),
            glbPreprocessing: readQueueConcurrencyValue(queueConcurrencyRecord.glbPreprocessing, 'queueConcurrency.glbPreprocessing'),
            sshImport: readQueueConcurrencyValue(queueConcurrencyRecord.sshImport, 'queueConcurrency.sshImport')
        }
    };
};

const readRoleApplyPayload = (payload: unknown): TeamClusterDaemonRoleApplyPayload => {
    const record = readPayloadRecord(payload);
    const roleConfigRecord = readPayloadRecord(record.roleConfig);
    const desiredRole = readString(roleConfigRecord.desiredRole, 'roleConfig.desiredRole');
    const effectiveRole = readString(roleConfigRecord.effectiveRole, 'roleConfig.effectiveRole');

    if (!['cluster', 'storage-server', 'compute-node'].includes(desiredRole)) {
        throw new Error('roleConfig.desiredRole must be cluster, storage-server, or compute-node');
    }

    if (!['cluster', 'storage-server', 'compute-node'].includes(effectiveRole)) {
        throw new Error('roleConfig.effectiveRole must be cluster, storage-server, or compute-node');
    }

    const drainingRecord = readPayloadRecord(roleConfigRecord.draining);
    if (typeof drainingRecord.compute !== 'boolean' || typeof drainingRecord.storage !== 'boolean') {
        throw new Error('roleConfig.draining.compute and roleConfig.draining.storage must be boolean');
    }

    const runtimeVersion = readNumber(roleConfigRecord.runtimeVersion, 'roleConfig.runtimeVersion');
    if (!Number.isInteger(runtimeVersion) || runtimeVersion < 1) {
        throw new Error('roleConfig.runtimeVersion must be an integer greater than or equal to 1');
    }

    const lastAppliedAt = typeof roleConfigRecord.lastAppliedAt === 'undefined'
        ? null
        : roleConfigRecord.lastAppliedAt === null
            ? null
            : readString(roleConfigRecord.lastAppliedAt, 'roleConfig.lastAppliedAt');

    return {
        roleConfig: {
            desiredRole: desiredRole as TeamClusterRole,
            effectiveRole: effectiveRole as TeamClusterRole,
            runtimeVersion,
            draining: {
                compute: drainingRecord.compute,
                storage: drainingRecord.storage
            },
            lastAppliedAt
        }
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

        deps.emitLifecycle('delete-failed' as RuntimeLifecycleEventType, details);
        await deps.reportDeleteFailed(details);
        process.exit(1);
    }
};

const executeRuntimeRestart = async (): Promise<void> => {
    process.exit(0);
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
        command: TEAM_CLUSTER_DAEMON_COMMAND.runtime.role.apply,
        execute: async (payload) => {
            let request: TeamClusterDaemonRoleApplyPayload;

            try {
                request = readRoleApplyPayload(payload);
            } catch {
                return rejectRuntimeCommand(
                    'Invalid runtime role payload: roleConfig.desiredRole, roleConfig.effectiveRole, roleConfig.runtimeVersion, and roleConfig.draining are required.'
                );
            }

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
        command: TEAM_CLUSTER_DAEMON_COMMAND.runtime.queueConcurrency.apply,
        execute: async (payload) => {
            let request: TeamClusterDaemonQueueConcurrencyApplyPayload;

            try {
                request = readQueueConcurrencyApplyPayload(payload);
            } catch {
                return rejectRuntimeCommand(
                    'Invalid queue concurrency payload: queueConcurrency.analysis, queueConcurrency.rasterizer, queueConcurrency.glbPreprocessing, and queueConcurrency.sshImport are required integers greater than or equal to 1.'
                );
            }

            try {
                deps.applyQueueConcurrency(request.queueConcurrency);
            } catch (error: unknown) {
                return rejectRuntimeCommand(
                    error instanceof Error
                        ? error.message
                        : 'Failed to apply queue concurrency'
                );
            }

            return {
                data: {
                    accepted: true,
                    queueConcurrency: request.queueConcurrency
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.runtime.restart,
        execute: async () => {
            deferRuntimeCommand(executeRuntimeRestart);

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
