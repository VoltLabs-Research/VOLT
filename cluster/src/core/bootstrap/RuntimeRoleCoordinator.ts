import { singleton } from '@shared/application/utilities/singleton';
import { getQueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { concurrencyTrackedWorkers, workersForScope } from '@shared/infrastructure/queues/worker-registry';
import { DAEMON_WORKERS } from '@core/bootstrap/workers';
import { logger } from '@shared/infrastructure/logger';
import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS, createDefaultTeamClusterRuntimeRoleConfig } from '@shared/contracts/types/team-cluster-runtime';
import type {
    TeamClusterDaemonQueueConcurrency,
    TeamClusterDaemonQueueScopeLimits,
    TeamClusterDaemonRoleApplyResult,
    TeamClusterDaemonRuntimeConfig,
    TeamClusterRuntimeRoleConfig
} from '@shared/contracts/types/team-cluster-runtime';

const withDefaults = <T extends object>(defaults: T, overrides?: Partial<T>): T => ({
    ...defaults,
    ...overrides
});

const withNestedDefaults = <T extends object>(defaults: T, overrides?: Partial<T>): T => {
    const merged = {} as T;
    for (const key of Object.keys(defaults) as Array<keyof T>) {
        merged[key] = {
            ...defaults[key],
            ...overrides?.[key]
        };
    }
    return merged;
};

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


export class RuntimeRoleCoordinator {
    private computeWorkersRunning = false;
    private snapshot: TeamClusterDaemonRuntimeConfig = {
        queueConcurrency: structuredClone(DEFAULT_QUEUE_CONCURRENCY),
        queueScopeLimits: structuredClone(DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS),
        roleConfig: createDefaultTeamClusterRuntimeRoleConfig()
    };
    private roleOperationQueue: Promise<unknown> = Promise.resolve();

    async initialize(runtimeConfig: TeamClusterDaemonRuntimeConfig): Promise<TeamClusterDaemonRuntimeConfig> {
        if (DAEMON_WORKERS.length === 0) {
            throw new Error('No daemon workers are declared: check DAEMON_WORKERS in @core/bootstrap/workers');
        }

        return this.runRoleOperation(async () => {
            this.snapshot = {
                queueConcurrency: withDefaults(DEFAULT_QUEUE_CONCURRENCY, runtimeConfig.queueConcurrency),
                queueScopeLimits: withNestedDefaults(DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS, runtimeConfig.queueScopeLimits),
                roleConfig: structuredClone(runtimeConfig.roleConfig)
            };

            getQueueScopeLimitsRegistry().apply(this.snapshot.queueScopeLimits);

            const alwaysWorkers = workersForScope(DAEMON_WORKERS, 'always');
            for (const worker of alwaysWorkers) {
                worker.resolve().start(this.snapshot.queueConcurrency[worker.concurrencyKey]);
            }

            logger.info(`@runtime-role: started ${alwaysWorkers.length} always workers`);

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
        this.snapshot.queueConcurrency = withDefaults(DEFAULT_QUEUE_CONCURRENCY, queueConcurrency);
        this.snapshot.queueScopeLimits = withNestedDefaults(DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS, queueScopeLimits);
        getQueueScopeLimitsRegistry().apply(this.snapshot.queueScopeLimits);

        for (const worker of workersForScope(DAEMON_WORKERS, 'always')) {
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
            draining: {
                compute: false,
                storage: false
            },
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
        for (const worker of concurrencyTrackedWorkers(DAEMON_WORKERS)) {
            worker.resolve().setConcurrency(this.snapshot.queueConcurrency[worker.concurrencyKey]);
        }
    }

    private startComputeWorkers(): void {
        if (this.computeWorkersRunning) {
            this.applyQueueConcurrency();
            return;
        }

        const workers = workersForScope(DAEMON_WORKERS, 'compute');
        for (const worker of workers) {
            worker.resolve().start(this.snapshot.queueConcurrency[worker.concurrencyKey]);
        }

        logger.info(`@runtime-role: started ${workers.length} compute workers`);

        this.computeWorkersRunning = true;
    }

    async stopComputeWorkers(): Promise<void> {
        if (!this.computeWorkersRunning) return;

        await Promise.all(workersForScope(DAEMON_WORKERS, 'compute').map((worker) => worker.resolve().stop()));

        this.computeWorkersRunning = false;
    }

    private roleRunsComputeWorkers(role: TeamClusterRuntimeRoleConfig['effectiveRole']): boolean {
        return role !== 'storage-server';
    }
}

export const getRuntimeRoleCoordinator = singleton((): RuntimeRoleCoordinator => new RuntimeRoleCoordinator());
