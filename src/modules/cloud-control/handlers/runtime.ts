import { readNumber, readPayloadRecord, readString } from './payloadValidation';
import {
    TEAM_CLUSTER_DAEMON_COMMAND,
    type TeamClusterDaemonRoleApplyPayload,
    type TeamClusterDaemonRoleApplyResult,
    type TeamClusterDaemonQueueConcurrency,
    type TeamClusterDaemonQueueConcurrencyApplyPayload,
    type TeamClusterDaemonQueueScopeLimits,
    type TeamClusterRole
} from '@/shared/contracts';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DaemonConfig } from '@/core/config';
import type { DockerRuntimeService } from '@/modules/platform/services';
import type { RuntimeLifecycleEventType } from '@voltstack/daemon-cluster-client';
import type { ReverseChannelCommandHandler } from '../services';

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

const readQueueConcurrencyValue = (value: unknown, fieldName: string): number => {
    const parsedValue = readNumber(value, fieldName);
    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
        throw new Error(`${fieldName} must be an integer greater than or equal to 1`);
    }

    return parsedValue;
};

const readQueueScopeLimitValue = (value: unknown, fieldName: string): number => {
    const parsedValue = readNumber(value, fieldName);
    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        throw new Error(`${fieldName} must be an integer greater than or equal to 0`);
    }

    return parsedValue;
};

const readQueueScopeLimitRecord = (
    value: unknown,
    fieldName: string
): { maxRunningPerTrajectory: number; maxRunningPerTeam: number } => {
    const record = readPayloadRecord(value);
    const keys = Object.keys(record).sort();
    const expectedKeys = ['maxRunningPerTeam', 'maxRunningPerTrajectory'];

    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
        throw new Error(`${fieldName} must include maxRunningPerTrajectory and maxRunningPerTeam`);
    }

    return {
        maxRunningPerTrajectory: readQueueScopeLimitValue(
            record.maxRunningPerTrajectory,
            `${fieldName}.maxRunningPerTrajectory`
        ),
        maxRunningPerTeam: readQueueScopeLimitValue(
            record.maxRunningPerTeam,
            `${fieldName}.maxRunningPerTeam`
        )
    };
};

const readQueueConcurrencyApplyPayload = (payload: unknown): TeamClusterDaemonQueueConcurrencyApplyPayload => {
    const record = readPayloadRecord(payload);
    const recordKeys = Object.keys(record).filter((key) => key !== 'metadata').sort();
    const expectedRootKeys = ['queueConcurrency', 'queueScopeLimits'];
    if (recordKeys.length !== expectedRootKeys.length || recordKeys.some((key, index) => key !== expectedRootKeys[index])) {
        throw new Error('payload must contain queueConcurrency and queueScopeLimits');
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

    const queueScopeLimitsRecord = readPayloadRecord(record.queueScopeLimits);
    const queueScopeLimitKeys = Object.keys(queueScopeLimitsRecord).sort();
    const expectedScopeKeys = [
        'analysisProcessing',
        'artifactUpload',
        'cloudUpload',
        'trajectoryCompression',
        'trajectoryGlbConversion'
    ];

    if (queueScopeLimitKeys.length !== expectedScopeKeys.length) {
        throw new Error('queueScopeLimits must include analysisProcessing, artifactUpload, trajectoryGlbConversion, cloudUpload, and trajectoryCompression');
    }

    for (const [index, key] of expectedScopeKeys.entries()) {
        if (queueScopeLimitKeys[index] !== key) {
            throw new Error('queueScopeLimits must include analysisProcessing, artifactUpload, trajectoryGlbConversion, cloudUpload, and trajectoryCompression');
        }
    }

    return {
        queueConcurrency: {
            analysis: readQueueConcurrencyValue(queueConcurrencyRecord.analysis, 'queueConcurrency.analysis'),
            rasterizer: readQueueConcurrencyValue(queueConcurrencyRecord.rasterizer, 'queueConcurrency.rasterizer'),
            glbPreprocessing: readQueueConcurrencyValue(queueConcurrencyRecord.glbPreprocessing, 'queueConcurrency.glbPreprocessing'),
            sshImport: readQueueConcurrencyValue(queueConcurrencyRecord.sshImport, 'queueConcurrency.sshImport')
        },
        queueScopeLimits: {
            analysisProcessing: readQueueScopeLimitRecord(
                queueScopeLimitsRecord.analysisProcessing,
                'queueScopeLimits.analysisProcessing'
            ),
            artifactUpload: readQueueScopeLimitRecord(
                queueScopeLimitsRecord.artifactUpload,
                'queueScopeLimits.artifactUpload'
            ),
            trajectoryGlbConversion: readQueueScopeLimitRecord(
                queueScopeLimitsRecord.trajectoryGlbConversion,
                'queueScopeLimits.trajectoryGlbConversion'
            ),
            cloudUpload: readQueueScopeLimitRecord(
                queueScopeLimitsRecord.cloudUpload,
                'queueScopeLimits.cloudUpload'
            ),
            trajectoryCompression: readQueueScopeLimitRecord(
                queueScopeLimitsRecord.trajectoryCompression,
                'queueScopeLimits.trajectoryCompression'
            )
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
                    'Invalid queue settings payload: queueConcurrency analysis/rasterizer/glbPreprocessing/sshImport must be integers >= 1 and queueScopeLimits must define maxRunningPerTrajectory/maxRunningPerTeam integers >= 0.'
                );
            }

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
        command: TEAM_CLUSTER_DAEMON_COMMAND.runtime.restart,
        execute: async () => {
            deferRuntimeCommand(executeRuntimeRestart);

            return acceptRuntimeCommand();
        }
    }
];
