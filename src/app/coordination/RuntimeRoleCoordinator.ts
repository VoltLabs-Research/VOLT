import { logger } from '@/core/logger';
import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS, TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION, buildTeamClusterEffectiveCapabilities, createDefaultTeamClusterRuntimeRoleConfig } from '@/core/runtime/contracts/teamClusterRuntime';
import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import type { ArtifactUploadWorkerService } from '@/modules/plugin/application/artifacts/ArtifactUploadWorkerService';
import type { AnalysisWorker } from '@/modules/analysis/application/execution/AnalysisWorker';
import type { SSHImportWorkerService } from '@/modules/trajectory/application/import/SSHImportWorkerService';
import type { TrajectoryGlbWorkerService } from '@/modules/trajectory/application/glb/TrajectoryGlbWorkerService';
import type { TrajectoryRasterWorkerService } from '@/modules/trajectory/application/raster/TrajectoryRasterWorkerService';
import type { QueueConcurrencyCoordinator } from './QueueConcurrencyCoordinator';

type TeamClusterDaemonQueueConcurrency = import('@/core/runtime/contracts/teamClusterRuntime').TeamClusterDaemonQueueConcurrency;
type TeamClusterDaemonQueueScopeLimits = import('@/core/runtime/contracts/teamClusterRuntime').TeamClusterDaemonQueueScopeLimits;
type TeamClusterDaemonRoleApplyResult = import('@/core/runtime/contracts/teamClusterRuntime').TeamClusterDaemonRoleApplyResult;
type TeamClusterDaemonRuntimeConfig = import('@/core/runtime/contracts/teamClusterRuntime').TeamClusterDaemonRuntimeConfig;
type TeamClusterEffectiveCapabilities = import('@/core/runtime/contracts/teamClusterRuntime').TeamClusterEffectiveCapabilities;
type TeamClusterRuntimeRoleConfig = import('@/core/runtime/contracts/teamClusterRuntime').TeamClusterRuntimeRoleConfig;

interface RuntimeRoleCoordinatorDependencies {
    analysisWorker: AnalysisWorker;
    artifactUploadWorkerService: ArtifactUploadWorkerService;
    trajectoryRasterWorkerService: TrajectoryRasterWorkerService;
    trajectoryGlbWorkerService: TrajectoryGlbWorkerService;
    sshImportWorkerService: SSHImportWorkerService;
}

interface QueueSettingsSnapshot {
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits;
}

const DEFAULT_QUEUE_CONCURRENCY: TeamClusterDaemonQueueConcurrency = {
    analysis: 8,
    rasterizer: 5,
    glbPreprocessing: 8,
    sshImport: 2
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
    lastAppliedAt: roleConfig.lastAppliedAt
});

const cloneEffectiveCapabilities = (
    effectiveCapabilities: TeamClusterEffectiveCapabilities
): TeamClusterEffectiveCapabilities => ({
    acceptsComputeJobs: effectiveCapabilities.acceptsComputeJobs,
    acceptsStorageWrites: effectiveCapabilities.acceptsStorageWrites,
    servesStorageReads: effectiveCapabilities.servesStorageReads,
    servesArtifactDownloads: effectiveCapabilities.servesArtifactDownloads
});

export class RuntimeRoleCoordinator {
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
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly dependencies: RuntimeRoleCoordinatorDependencies
    ) {}

    async initialize(runtimeConfig: TeamClusterDaemonRuntimeConfig): Promise<TeamClusterDaemonRuntimeConfig> {
        this.snapshot = {
            contractVersion: runtimeConfig.contractVersion,
            queueConcurrency: cloneQueueConcurrency(runtimeConfig.queueConcurrency),
            queueScopeLimits: cloneQueueScopeLimits(runtimeConfig.queueScopeLimits),
            roleConfig: cloneRoleConfig(runtimeConfig.roleConfig),
            effectiveCapabilities: cloneEffectiveCapabilities(runtimeConfig.effectiveCapabilities)
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
    ): QueueSettingsSnapshot {
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
        const nextRoleConfig = cloneRoleConfig(roleConfig);
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

        const snapshot = this.getSnapshot();

        return {
            accepted: true,
            roleConfig: snapshot.roleConfig,
            effectiveCapabilities: snapshot.effectiveCapabilities
        };
    }

    private startComputeWorkers(): void {
        if (this.computeWorkersRunning) {
            this.queueConcurrencyCoordinator.apply(this.snapshot.queueConcurrency);
            return;
        }

        this.dependencies.analysisWorker.start(this.snapshot.queueConcurrency.analysis);
        this.dependencies.artifactUploadWorkerService.start();
        this.dependencies.trajectoryRasterWorkerService.start(this.snapshot.queueConcurrency.rasterizer);
        this.dependencies.trajectoryGlbWorkerService.start(this.snapshot.queueConcurrency.glbPreprocessing);
        this.dependencies.sshImportWorkerService.start(this.snapshot.queueConcurrency.sshImport);
        this.computeWorkersRunning = true;
    }

    private async stopComputeWorkers(): Promise<void> {
        if (!this.computeWorkersRunning) {
            return;
        }

        await this.dependencies.analysisWorker.stop();
        await this.dependencies.artifactUploadWorkerService.stop();
        await this.dependencies.trajectoryRasterWorkerService.stop();
        await this.dependencies.trajectoryGlbWorkerService.stop();
        await this.dependencies.sshImportWorkerService.stop();
        this.computeWorkersRunning = false;
    }
}
