import { logger } from '@/core/logger';
import {
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
    TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION,
    buildTeamClusterEffectiveCapabilities,
    createDefaultTeamClusterRuntimeRoleConfig,
    type TeamClusterDaemonQueueConcurrency,
    type TeamClusterDaemonQueueScopeLimits,
    type TeamClusterDaemonRoleApplyResult,
    type TeamClusterDaemonRuntimeConfig,
    type TeamClusterEffectiveCapabilities,
    type TeamClusterRuntimeRoleConfig
} from '@/shared/contracts';
import type { QueueConcurrencyCoordinator, QueueScopeLimitsRegistry } from '@/modules/platform/services';
import type { ArtifactUploadWorkerService } from '@/modules/artifacts/services';
import type { AnalysisWorker } from '@/modules/job-runtime/services';
import type { SSHImportWorkerService } from '@/modules/ssh-import/services';
import type {
    TrajectoryGlbWorkerService,
    TrajectoryRasterWorkerService
} from '@/modules/trajectory-native/services';

interface RuntimeRoleCoordinatorDependencies {
    analysisWorker: AnalysisWorker;
    artifactUploadWorkerService: ArtifactUploadWorkerService;
    trajectoryRasterWorkerService: TrajectoryRasterWorkerService;
    trajectoryGlbWorkerService: TrajectoryGlbWorkerService;
    sshImportWorkerService: SSHImportWorkerService;
}

const DEFAULT_QUEUE_CONCURRENCY: TeamClusterDaemonQueueConcurrency = {
    analysis: 1,
    rasterizer: 1,
    glbPreprocessing: 1,
    sshImport: 1
};

const cloneQueueConcurrency = (
    queueConcurrency: TeamClusterDaemonQueueConcurrency
): TeamClusterDaemonQueueConcurrency => ({
    analysis: queueConcurrency.analysis,
    rasterizer: queueConcurrency.rasterizer,
    glbPreprocessing: queueConcurrency.glbPreprocessing,
    sshImport: queueConcurrency.sshImport
});

const cloneQueueScopeLimits = (
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits
): TeamClusterDaemonQueueScopeLimits => ({
    analysisProcessing: {
        ...queueScopeLimits.analysisProcessing
    },
    artifactUpload: {
        ...queueScopeLimits.artifactUpload
    },
    trajectoryGlbConversion: {
        ...queueScopeLimits.trajectoryGlbConversion
    },
    cloudUpload: {
        ...queueScopeLimits.cloudUpload
    },
    trajectoryCompression: {
        ...queueScopeLimits.trajectoryCompression
    }
});

const cloneRoleConfig = (
    roleConfig: TeamClusterRuntimeRoleConfig
): TeamClusterRuntimeRoleConfig => ({
    desiredRole: roleConfig.desiredRole,
    effectiveRole: roleConfig.effectiveRole,
    runtimeVersion: roleConfig.runtimeVersion,
    draining: {
        compute: roleConfig.draining.compute,
        storage: roleConfig.draining.storage
    },
    lastAppliedAt: roleConfig.lastAppliedAt ?? null
});

const cloneEffectiveCapabilities = (
    effectiveCapabilities: TeamClusterEffectiveCapabilities
): TeamClusterEffectiveCapabilities => ({
    acceptsComputeJobs: effectiveCapabilities.acceptsComputeJobs,
    acceptsStorageWrites: effectiveCapabilities.acceptsStorageWrites,
    servesStorageReads: effectiveCapabilities.servesStorageReads,
    servesArtifactDownloads: effectiveCapabilities.servesArtifactDownloads
});

const normalizeRoleConfig = (roleConfig?: TeamClusterRuntimeRoleConfig): TeamClusterRuntimeRoleConfig => {
    if (!roleConfig) {
        return createDefaultTeamClusterRuntimeRoleConfig();
    }

    return {
        desiredRole: roleConfig.desiredRole,
        effectiveRole: roleConfig.effectiveRole,
        runtimeVersion: Number.isInteger(roleConfig.runtimeVersion) && roleConfig.runtimeVersion >= 1
            ? roleConfig.runtimeVersion
            : 1,
        draining: {
            compute: roleConfig.draining?.compute === true,
            storage: roleConfig.draining?.storage === true
        },
        lastAppliedAt: roleConfig.lastAppliedAt ?? null
    };
};

export class RuntimeRoleCoordinator {
    private dependencies: RuntimeRoleCoordinatorDependencies | null = null;
    private computeWorkersRunning = false;
    private snapshot: TeamClusterDaemonRuntimeConfig = {
        contractVersion: TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION,
        queueConcurrency: cloneQueueConcurrency(DEFAULT_QUEUE_CONCURRENCY),
        queueScopeLimits: cloneQueueScopeLimits(DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS),
        roleConfig: createDefaultTeamClusterRuntimeRoleConfig(),
        effectiveCapabilities: buildTeamClusterEffectiveCapabilities('cluster')
    };

    constructor(
        private readonly queueConcurrencyCoordinator: QueueConcurrencyCoordinator,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry
    ) {}

    bind(dependencies: RuntimeRoleCoordinatorDependencies): void {
        this.dependencies = dependencies;
    }

    async initialize(runtimeConfig: TeamClusterDaemonRuntimeConfig): Promise<TeamClusterDaemonRuntimeConfig> {
        this.snapshot = {
            contractVersion: runtimeConfig.contractVersion ?? TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION,
            queueConcurrency: cloneQueueConcurrency(runtimeConfig.queueConcurrency),
            queueScopeLimits: cloneQueueScopeLimits(runtimeConfig.queueScopeLimits),
            roleConfig: normalizeRoleConfig(runtimeConfig.roleConfig),
            effectiveCapabilities: cloneEffectiveCapabilities(
                runtimeConfig.effectiveCapabilities
                ?? buildTeamClusterEffectiveCapabilities(runtimeConfig.roleConfig?.effectiveRole ?? 'cluster')
            )
        };

        this.queueScopeLimitsRegistry.apply(this.snapshot.queueScopeLimits);

        await this.applyRoleConfig(this.snapshot.roleConfig);
        return this.getSnapshot();
    }

    getSnapshot(): TeamClusterDaemonRuntimeConfig {
        return {
            contractVersion: this.snapshot.contractVersion,
            queueConcurrency: cloneQueueConcurrency(this.snapshot.queueConcurrency),
            queueScopeLimits: cloneQueueScopeLimits(this.snapshot.queueScopeLimits),
            roleConfig: cloneRoleConfig(this.snapshot.roleConfig),
            effectiveCapabilities: cloneEffectiveCapabilities(this.snapshot.effectiveCapabilities)
        };
    }

    applyQueueSettings(
        queueConcurrency: TeamClusterDaemonQueueConcurrency,
        queueScopeLimits: TeamClusterDaemonQueueScopeLimits
    ): { queueConcurrency: TeamClusterDaemonQueueConcurrency; queueScopeLimits: TeamClusterDaemonQueueScopeLimits } {
        this.snapshot.queueConcurrency = cloneQueueConcurrency(queueConcurrency);
        this.snapshot.queueScopeLimits = cloneQueueScopeLimits(queueScopeLimits);
        this.queueScopeLimitsRegistry.apply(this.snapshot.queueScopeLimits);

        if (this.computeWorkersRunning) {
            this.queueConcurrencyCoordinator.apply(queueConcurrency);
        }

        logger.info({
            action: 'cluster.capabilities.snapshot',
            queueConcurrency: this.snapshot.queueConcurrency,
            queueScopeLimits: this.snapshot.queueScopeLimits,
            effectiveCapabilities: this.snapshot.effectiveCapabilities,
            effectiveRole: this.snapshot.roleConfig.effectiveRole
        }, 'Applied runtime queue concurrency snapshot');

        return {
            queueConcurrency: cloneQueueConcurrency(this.snapshot.queueConcurrency),
            queueScopeLimits: cloneQueueScopeLimits(this.snapshot.queueScopeLimits)
        };
    }

    async applyRoleConfig(roleConfig: TeamClusterRuntimeRoleConfig): Promise<TeamClusterDaemonRoleApplyResult> {
        this.ensureBound();

        const nextRoleConfig = normalizeRoleConfig(roleConfig);
        const previousEffectiveRole = this.snapshot.roleConfig.effectiveRole;
        const isComputeDrain = previousEffectiveRole !== nextRoleConfig.desiredRole
            && this.snapshot.effectiveCapabilities.acceptsComputeJobs
            && !buildTeamClusterEffectiveCapabilities(nextRoleConfig.desiredRole).acceptsComputeJobs;
        const isStorageDrain = previousEffectiveRole !== nextRoleConfig.desiredRole
            && this.snapshot.effectiveCapabilities.acceptsStorageWrites
            && !buildTeamClusterEffectiveCapabilities(nextRoleConfig.desiredRole).acceptsStorageWrites;

        logger.info({
            action: 'cluster.role.apply.started',
            desiredRole: nextRoleConfig.desiredRole,
            effectiveRole: previousEffectiveRole,
            runtimeVersion: nextRoleConfig.runtimeVersion
        }, 'Applying runtime role configuration');

        this.snapshot.roleConfig = {
            ...cloneRoleConfig(this.snapshot.roleConfig),
            desiredRole: nextRoleConfig.desiredRole,
            runtimeVersion: nextRoleConfig.runtimeVersion,
            draining: {
                compute: isComputeDrain,
                storage: isStorageDrain
            }
        };
        this.snapshot.effectiveCapabilities = buildTeamClusterEffectiveCapabilities(
            this.snapshot.roleConfig.effectiveRole,
            this.snapshot.roleConfig.draining
        );

        if (isComputeDrain || isStorageDrain) {
            logger.info({
                action: 'cluster.role.apply.draining',
                desiredRole: nextRoleConfig.desiredRole,
                effectiveRole: previousEffectiveRole,
                draining: this.snapshot.roleConfig.draining
            }, 'Draining runtime capabilities before final role switch');
        }

        if (isComputeDrain) {
            await this.stopComputeWorkers();
        }

        if (buildTeamClusterEffectiveCapabilities(nextRoleConfig.desiredRole).acceptsComputeJobs) {
            this.startComputeWorkers();
        }

        this.snapshot.roleConfig = {
            desiredRole: nextRoleConfig.desiredRole,
            effectiveRole: nextRoleConfig.desiredRole,
            runtimeVersion: nextRoleConfig.runtimeVersion,
            draining: {
                compute: false,
                storage: false
            },
            lastAppliedAt: new Date().toISOString()
        };
        this.snapshot.effectiveCapabilities = buildTeamClusterEffectiveCapabilities(
            this.snapshot.roleConfig.effectiveRole
        );

        logger.info({
            action: 'cluster.role.apply.completed',
            roleConfig: this.snapshot.roleConfig,
            effectiveCapabilities: this.snapshot.effectiveCapabilities
        }, 'Runtime role configuration applied');

        return {
            accepted: true,
            roleConfig: cloneRoleConfig(this.snapshot.roleConfig),
            effectiveCapabilities: cloneEffectiveCapabilities(this.snapshot.effectiveCapabilities)
        };
    }

    private startComputeWorkers(): void {
        this.ensureBound();
        if (this.computeWorkersRunning) {
            this.queueConcurrencyCoordinator.apply(this.snapshot.queueConcurrency);
            return;
        }

        const dependencies = this.dependencies as RuntimeRoleCoordinatorDependencies;
        dependencies.analysisWorker.start(this.snapshot.queueConcurrency.analysis);
        dependencies.artifactUploadWorkerService.start();
        dependencies.trajectoryRasterWorkerService.start(this.snapshot.queueConcurrency.rasterizer);
        dependencies.trajectoryGlbWorkerService.start(this.snapshot.queueConcurrency.glbPreprocessing);
        dependencies.sshImportWorkerService.start(this.snapshot.queueConcurrency.sshImport);
        this.computeWorkersRunning = true;
    }

    private async stopComputeWorkers(): Promise<void> {
        this.ensureBound();
        if (!this.computeWorkersRunning) {
            return;
        }

        const dependencies = this.dependencies as RuntimeRoleCoordinatorDependencies;
        await dependencies.analysisWorker.stop();
        await dependencies.artifactUploadWorkerService.stop();
        await dependencies.trajectoryRasterWorkerService.stop();
        await dependencies.trajectoryGlbWorkerService.stop();
        await dependencies.sshImportWorkerService.stop();
        this.computeWorkersRunning = false;
    }

    private ensureBound(): void {
        if (this.dependencies) {
            return;
        }

        throw new Error('RuntimeRoleCoordinator dependencies are not bound');
    }
}
