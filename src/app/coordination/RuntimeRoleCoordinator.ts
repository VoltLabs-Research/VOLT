import { Service } from '@/core/decorators/service';
import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS, createDefaultTeamClusterRuntimeRoleConfig } from '@/core/runtime/contracts/team-cluster-runtime';
import type {
    TeamClusterDaemonQueueConcurrency,
    TeamClusterDaemonQueueScopeLimits,
    TeamClusterDaemonRoleApplyResult,
    TeamClusterDaemonRuntimeConfig,
    TeamClusterRuntimeRoleConfig
} from '@/core/runtime/contracts/team-cluster-runtime';
import type { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import type { ArtifactUploadWorker } from '@/modules/plugin/application/artifacts/ArtifactUploadWorker';
import type { PluginWarmupWorker } from '@/modules/plugin/application/binaries/PluginWarmupWorker';
import type { AnalysisWorker } from '@/modules/analysis/application/workers/AnalysisWorker';
import type { SSHImportWorker } from '@/modules/trajectory/application/import/SSHImportWorker';
import type { TrajectoryGlbWorker } from '@/modules/trajectory/application/glb/TrajectoryGlbWorker';
import type { TrajectoryRasterWorker } from '@/modules/trajectory/application/raster/TrajectoryRasterWorker';
import type { QueueConcurrencyCoordinator } from './QueueConcurrencyCoordinator';

interface QueueSettingsSnapshot {
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits;
}

const DEFAULT_QUEUE_CONCURRENCY: TeamClusterDaemonQueueConcurrency = {
    analysis: 8,
    rasterizer: 5,
    glbPreprocessing: 8,
    artifactUpload: 8,
    sshImport: 2
};

const normalizeQueueConcurrency = (
    queueConcurrency: Partial<TeamClusterDaemonQueueConcurrency> | undefined
): TeamClusterDaemonQueueConcurrency => ({
    ...DEFAULT_QUEUE_CONCURRENCY,
    ...queueConcurrency
});

const normalizeQueueScopeLimits = (
    queueScopeLimits: Partial<TeamClusterDaemonQueueScopeLimits> | undefined
): TeamClusterDaemonQueueScopeLimits => ({
    analysisProcessing: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.analysisProcessing,
        ...queueScopeLimits?.analysisProcessing
    },
    artifactUpload: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.artifactUpload,
        ...queueScopeLimits?.artifactUpload
    },
    trajectoryRasterization: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryRasterization,
        ...queueScopeLimits?.trajectoryRasterization
    },
    trajectoryGlbConversion: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryGlbConversion,
        ...queueScopeLimits?.trajectoryGlbConversion
    },
    cloudUpload: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.cloudUpload,
        ...queueScopeLimits?.cloudUpload
    },
    trajectoryCompression: {
        ...DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryCompression,
        ...queueScopeLimits?.trajectoryCompression
    }
});

@Service('runtimeRoleCoordinator')
export class RuntimeRoleCoordinator {
    private computeWorkersRunning = false;
    private snapshot: TeamClusterDaemonRuntimeConfig = {
        queueConcurrency: structuredClone(DEFAULT_QUEUE_CONCURRENCY),
        queueScopeLimits: structuredClone(DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS),
        roleConfig: createDefaultTeamClusterRuntimeRoleConfig()
    };
    private roleOperationQueue: Promise<unknown> = Promise.resolve();

    constructor(
        private readonly queueConcurrencyCoordinator: QueueConcurrencyCoordinator,
        private readonly queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly analysisWorker: AnalysisWorker,
        private readonly artifactUploadWorker: ArtifactUploadWorker,
        private readonly pluginWarmupWorker: PluginWarmupWorker,
        private readonly trajectoryRasterWorker: TrajectoryRasterWorker,
        private readonly trajectoryGlbWorker: TrajectoryGlbWorker,
        private readonly sshImportWorker: SSHImportWorker
    ) {}

    async initialize(runtimeConfig: TeamClusterDaemonRuntimeConfig): Promise<TeamClusterDaemonRuntimeConfig> {
        return this.runRoleOperation(async () => {
            this.snapshot = {
                queueConcurrency: normalizeQueueConcurrency(runtimeConfig.queueConcurrency),
                queueScopeLimits: normalizeQueueScopeLimits(runtimeConfig.queueScopeLimits),
                roleConfig: structuredClone(runtimeConfig.roleConfig)
            };

            this.queueScopeLimitsRegistry.apply(this.snapshot.queueScopeLimits);

            await this.applyRoleConfigInternal(this.snapshot.roleConfig);

            return this.getSnapshot();
        });
    }

    getSnapshot(): TeamClusterDaemonRuntimeConfig {
        return structuredClone(this.snapshot);
    }

    applyQueueSettings(
        queueConcurrency: TeamClusterDaemonQueueConcurrency,
        queueScopeLimits: TeamClusterDaemonQueueScopeLimits
    ): QueueSettingsSnapshot {
        this.snapshot.queueConcurrency = normalizeQueueConcurrency(queueConcurrency);
        this.snapshot.queueScopeLimits = normalizeQueueScopeLimits(queueScopeLimits);
        this.queueScopeLimitsRegistry.apply(this.snapshot.queueScopeLimits);

        if (this.computeWorkersRunning) {
            this.queueConcurrencyCoordinator.apply(queueConcurrency);
        }

        return {
            queueConcurrency: structuredClone(this.snapshot.queueConcurrency),
            queueScopeLimits: structuredClone(this.snapshot.queueScopeLimits)
        };
    }

    applyRoleConfig(roleConfig: TeamClusterRuntimeRoleConfig): Promise<TeamClusterDaemonRoleApplyResult> {
        return this.runRoleOperation(() => this.applyRoleConfigInternal(roleConfig));
    }

    private async applyRoleConfigInternal(roleConfig: TeamClusterRuntimeRoleConfig): Promise<TeamClusterDaemonRoleApplyResult> {
        const nextRoleConfig = structuredClone(roleConfig);
        const previousEffectiveRole = this.snapshot.roleConfig.effectiveRole;

        const isComputeDrain = previousEffectiveRole !== nextRoleConfig.desiredRole
            && this.roleRunsComputeWorkers(previousEffectiveRole)
            && !this.roleRunsComputeWorkers(nextRoleConfig.desiredRole);

        if (isComputeDrain) {
            await this.stopComputeWorkers();
        }

        if (this.roleRunsComputeWorkers(nextRoleConfig.desiredRole)) {
            this.startComputeWorkers();
        }

        this.snapshot.roleConfig = {
            ...structuredClone(this.snapshot.roleConfig),
            desiredRole: nextRoleConfig.desiredRole,
            effectiveRole: nextRoleConfig.desiredRole,
            runtimeVersion: nextRoleConfig.runtimeVersion,
            draining: { compute: false, storage: false },
            lastAppliedAt: new Date().toISOString()
        };

        return {
            accepted: true,
            roleConfig: this.getSnapshot().roleConfig
        };
    }

    private runRoleOperation<R>(task: () => Promise<R>): Promise<R> {
        const next = this.roleOperationQueue.catch(() => undefined).then(task);
        this.roleOperationQueue = next.catch(() => undefined);
        return next;
    }

    private startComputeWorkers(): void {
        if (this.computeWorkersRunning) {
            this.queueConcurrencyCoordinator.apply(this.snapshot.queueConcurrency);
            return;
        }

        const { analysis, rasterizer, glbPreprocessing, artifactUpload, sshImport } = this.snapshot.queueConcurrency;

        this.analysisWorker.start(analysis);
        this.artifactUploadWorker.start(artifactUpload);
        this.pluginWarmupWorker.start();
        this.trajectoryRasterWorker.start(rasterizer);
        this.trajectoryGlbWorker.start(glbPreprocessing);
        this.sshImportWorker.start(sshImport);

        this.computeWorkersRunning = true;
    }

    async stopComputeWorkers(): Promise<void> {
        if (!this.computeWorkersRunning) return;

        await Promise.all([
            this.analysisWorker.stop(),
            this.artifactUploadWorker.stop(),
            this.pluginWarmupWorker.stop(),
            this.trajectoryRasterWorker.stop(),
            this.trajectoryGlbWorker.stop(),
            this.sshImportWorker.stop()
        ]);

        this.computeWorkersRunning = false;
    }

    private roleRunsComputeWorkers(role: TeamClusterRuntimeRoleConfig['effectiveRole']): boolean {
        return role !== 'storage-server';
    }
}
