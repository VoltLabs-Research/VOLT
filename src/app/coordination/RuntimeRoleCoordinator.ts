import { logger } from '@/core/logger';
import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS, TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION, createDefaultTeamClusterRuntimeRoleConfig } from '@/core/runtime/contracts/team-cluster-runtime';
import type {
    TeamClusterDaemonQueueConcurrency,
    TeamClusterDaemonQueueScopeLimits,
    TeamClusterDaemonRoleApplyResult,
    TeamClusterDaemonRuntimeConfig,
    TeamClusterRuntimeRoleConfig
} from '@/core/runtime/contracts/team-cluster-runtime';
import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import type { ArtifactUploadWorker } from '@/modules/plugin/application/artifacts/ArtifactUploadWorker';
import type { AnalysisWorker } from '@/modules/analysis/application/workers/AnalysisWorker';
import type { SSHImportWorker } from '@/modules/trajectory/application/import/SSHImportWorker';
import type { TrajectoryGlbWorker } from '@/modules/trajectory/application/glb/TrajectoryGlbWorker';
import type { TrajectoryRasterWorker } from '@/modules/trajectory/application/raster/TrajectoryRasterWorker';
import type { QueueConcurrencyCoordinator } from './QueueConcurrencyCoordinator';

interface RuntimeRoleCoordinatorDependencies {
    analysisWorker: AnalysisWorker;
    artifactUploadWorker: ArtifactUploadWorker;
    trajectoryRasterWorker: TrajectoryRasterWorker;
    trajectoryGlbWorker: TrajectoryGlbWorker;
    sshImportWorker: SSHImportWorker;
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

const describeQueueConcurrency = (queueConcurrency: TeamClusterDaemonQueueConcurrency): string => {
    return `analysis=${queueConcurrency.analysis}, rasterizer=${queueConcurrency.rasterizer}, glbPreprocessing=${queueConcurrency.glbPreprocessing}, sshImport=${queueConcurrency.sshImport}`;
};

const describeQueueScopeLimits = (queueScopeLimits: TeamClusterDaemonQueueScopeLimits): string => {
    return `analysisProcessing(perTrajectory=${queueScopeLimits.analysisProcessing.maxRunningPerTrajectory}, perTeam=${queueScopeLimits.analysisProcessing.maxRunningPerTeam}), artifactUpload(perTrajectory=${queueScopeLimits.artifactUpload.maxRunningPerTrajectory}, perTeam=${queueScopeLimits.artifactUpload.maxRunningPerTeam}), trajectoryGlbConversion(perTrajectory=${queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory}, perTeam=${queueScopeLimits.trajectoryGlbConversion.maxRunningPerTeam}), cloudUpload(perTrajectory=${queueScopeLimits.cloudUpload.maxRunningPerTrajectory}, perTeam=${queueScopeLimits.cloudUpload.maxRunningPerTeam}), trajectoryCompression(perTrajectory=${queueScopeLimits.trajectoryCompression.maxRunningPerTrajectory}, perTeam=${queueScopeLimits.trajectoryCompression.maxRunningPerTeam})`;
};

const roleRunsComputeWorkers = (role: TeamClusterRuntimeRoleConfig['effectiveRole']): boolean => {
    return role !== 'storage-server';
};

const roleOwnsStorage = (role: TeamClusterRuntimeRoleConfig['effectiveRole']): boolean => {
    return role !== 'compute-node';
};

const describeRoleConfig = (roleConfig: TeamClusterRuntimeRoleConfig): string => {
    return `desiredRole=${roleConfig.desiredRole}, effectiveRole=${roleConfig.effectiveRole}, runtimeVersion=${roleConfig.runtimeVersion}, drainingCompute=${roleConfig.draining.compute}, drainingStorage=${roleConfig.draining.storage}, lastAppliedAt=${roleConfig.lastAppliedAt ?? 'null'}`;
};

export class RuntimeRoleCoordinator {
    private computeWorkersRunning = false;
    private snapshot: TeamClusterDaemonRuntimeConfig = {
        contractVersion: TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION,
        queueConcurrency: structuredClone(DEFAULT_QUEUE_CONCURRENCY),
        queueScopeLimits: structuredClone(DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS),
        roleConfig: createDefaultTeamClusterRuntimeRoleConfig()
    };

    constructor(
        private readonly queueConcurrencyCoordinator: QueueConcurrencyCoordinator,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly dependencies: RuntimeRoleCoordinatorDependencies
    ) {}

    async initialize(runtimeConfig: TeamClusterDaemonRuntimeConfig): Promise<TeamClusterDaemonRuntimeConfig> {
        this.snapshot = structuredClone(runtimeConfig);

        this.queueScopeLimitsRegistry.apply(this.snapshot.queueScopeLimits);

        await this.applyRoleConfig(this.snapshot.roleConfig);

        return this.getSnapshot();
    }

    getSnapshot(): TeamClusterDaemonRuntimeConfig {
        return structuredClone(this.snapshot);
    }

    applyQueueSettings(
        queueConcurrency: TeamClusterDaemonQueueConcurrency,
        queueScopeLimits: TeamClusterDaemonQueueScopeLimits
    ): QueueSettingsSnapshot {
        this.snapshot.queueConcurrency = structuredClone(queueConcurrency);
        this.snapshot.queueScopeLimits = structuredClone(queueScopeLimits);
        this.queueScopeLimitsRegistry.apply(this.snapshot.queueScopeLimits);

        if (this.computeWorkersRunning) {
            this.queueConcurrencyCoordinator.apply(queueConcurrency);
        }

        return {
            queueConcurrency: structuredClone(this.snapshot.queueConcurrency),
            queueScopeLimits: structuredClone(this.snapshot.queueScopeLimits)
        };
    }

    async applyRoleConfig(roleConfig: TeamClusterRuntimeRoleConfig): Promise<TeamClusterDaemonRoleApplyResult> {
        const nextRoleConfig = structuredClone(roleConfig);
        const previousEffectiveRole = this.snapshot.roleConfig.effectiveRole;
        const isComputeDrain = previousEffectiveRole !== nextRoleConfig.desiredRole
            && roleRunsComputeWorkers(previousEffectiveRole)
            && !roleRunsComputeWorkers(nextRoleConfig.desiredRole);
        const isStorageDrain = previousEffectiveRole !== nextRoleConfig.desiredRole
            && roleOwnsStorage(previousEffectiveRole)
            && !roleOwnsStorage(nextRoleConfig.desiredRole);

        this.snapshot.roleConfig = {
            ...structuredClone(this.snapshot.roleConfig),
            desiredRole: nextRoleConfig.desiredRole,
            runtimeVersion: nextRoleConfig.runtimeVersion,
            draining: {
                compute: isComputeDrain,
                storage: isStorageDrain
            }
        };

        if (isComputeDrain) {
            await this.stopComputeWorkers();
        }

        if (roleRunsComputeWorkers(nextRoleConfig.desiredRole)) {
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

        const snapshot = this.getSnapshot();

        return {
            accepted: true,
            roleConfig: snapshot.roleConfig
        };
    }

    private startComputeWorkers(): void {
        if (this.computeWorkersRunning) {
            this.queueConcurrencyCoordinator.apply(this.snapshot.queueConcurrency);
            return;
        }

        this.dependencies.analysisWorker.start(this.snapshot.queueConcurrency.analysis);
        this.dependencies.artifactUploadWorker.start();
        this.dependencies.trajectoryRasterWorker.start(this.snapshot.queueConcurrency.rasterizer);
        this.dependencies.trajectoryGlbWorker.start(this.snapshot.queueConcurrency.glbPreprocessing);
        this.dependencies.sshImportWorker.start(this.snapshot.queueConcurrency.sshImport);
        this.computeWorkersRunning = true;
    }

    private async stopComputeWorkers(): Promise<void> {
        if (!this.computeWorkersRunning) {
            return;
        }

        await this.dependencies.analysisWorker.stop();
        await this.dependencies.artifactUploadWorker.stop();
        await this.dependencies.trajectoryRasterWorker.stop();
        await this.dependencies.trajectoryGlbWorker.stop();
        await this.dependencies.sshImportWorker.stop();
        this.computeWorkersRunning = false;
    }
}
