import { getQueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { mountConcurrencyTrackedWorkers, mountWorkers } from '@core/bootstrap/mount-workers';
import { logger } from '@shared/infrastructure/logger';
import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS, createDefaultTeamClusterRuntimeRoleConfig } from '@shared/contracts/types/team-cluster-runtime';
import type {
    TeamClusterDaemonQueueConcurrency,
    TeamClusterDaemonQueueScopeLimits,
    TeamClusterDaemonRoleApplyResult,
    TeamClusterDaemonRuntimeConfig,
    TeamClusterRuntimeRoleConfig
} from '@shared/contracts/types/team-cluster-runtime';

interface QueueSettingsSnapshot {
    queueConcurrency: TeamClusterDaemonQueueConcurrency;
    queueScopeLimits: TeamClusterDaemonQueueScopeLimits;
}

const DEFAULT_QUEUE_CONCURRENCY: TeamClusterDaemonQueueConcurrency = {
    analysis: 8,
    rasterizer: 8,
    glbPreprocessing: 16,
    artifactUpload: 16,
    pluginWarmup: 4
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
    }
});

export class RuntimeRoleCoordinator {
    private computeWorkersRunning = false;
    private snapshot: TeamClusterDaemonRuntimeConfig = {
        queueConcurrency: structuredClone(DEFAULT_QUEUE_CONCURRENCY),
        queueScopeLimits: structuredClone(DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS),
        roleConfig: createDefaultTeamClusterRuntimeRoleConfig()
    };
    private roleOperationQueue: Promise<unknown> = Promise.resolve();

    async initialize(runtimeConfig: TeamClusterDaemonRuntimeConfig): Promise<TeamClusterDaemonRuntimeConfig> {
        return this.runRoleOperation(async () => {
            this.snapshot = {
                queueConcurrency: normalizeQueueConcurrency(runtimeConfig.queueConcurrency),
                queueScopeLimits: normalizeQueueScopeLimits(runtimeConfig.queueScopeLimits),
                roleConfig: structuredClone(runtimeConfig.roleConfig)
            };

            getQueueScopeLimitsRegistry().apply(this.snapshot.queueScopeLimits);

            for (const worker of mountWorkers('always')) {
                worker.resolve().start(this.snapshot.queueConcurrency[worker.concurrencyKey]);
            }

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
        getQueueScopeLimitsRegistry().apply(this.snapshot.queueScopeLimits);

        for (const worker of mountWorkers('always')) {
            worker.resolve().setConcurrency(this.snapshot.queueConcurrency[worker.concurrencyKey]);
        }

        if (this.computeWorkersRunning) {
            this.applyQueueConcurrency();
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

    private applyQueueConcurrency(): void {
        for (const worker of mountConcurrencyTrackedWorkers()) {
            worker.resolve().setConcurrency(this.snapshot.queueConcurrency[worker.concurrencyKey]);
        }
    }

    private startComputeWorkers(): void {
        if (this.computeWorkersRunning) {
            this.applyQueueConcurrency();
            return;
        }

        const workers = mountWorkers('compute');
        for (const worker of workers) {
            worker.resolve().start(this.snapshot.queueConcurrency[worker.concurrencyKey]);
        }

        logger.info(`@runtime-role: started ${workers.length} compute workers`);

        this.computeWorkersRunning = true;
    }

    async stopComputeWorkers(): Promise<void> {
        if (!this.computeWorkersRunning) return;

        await Promise.all(mountWorkers('compute').map((worker) => worker.resolve().stop()));

        this.computeWorkersRunning = false;
    }

    private roleRunsComputeWorkers(role: TeamClusterRuntimeRoleConfig['effectiveRole']): boolean {
        return role !== 'storage-server';
    }
}

let runtimeRoleCoordinatorInstance: RuntimeRoleCoordinator | null = null;

export const getRuntimeRoleCoordinator = (): RuntimeRoleCoordinator => {
    runtimeRoleCoordinatorInstance ??= new RuntimeRoleCoordinator();
    return runtimeRoleCoordinatorInstance;
};
