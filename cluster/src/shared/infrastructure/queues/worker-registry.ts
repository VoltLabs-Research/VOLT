import type { TeamClusterDaemonQueueConcurrency } from '@shared/contracts/types/team-cluster-runtime';

type WorkerStartScope = 'always' | 'compute';

interface ManagedWorker {
    start(concurrency: number): void;
    stop(): Promise<void>;
    setConcurrency(concurrency: number): void;
}

interface WorkerRegistration {
    name: string;
    scope: WorkerStartScope;
    concurrencyKey: keyof TeamClusterDaemonQueueConcurrency;
    tracksConcurrencyWhileRunning: boolean;
}

export interface WorkerBinding extends WorkerRegistration {
    resolve: () => ManagedWorker;
}

export const defineDaemonWorker = <TWorker extends ManagedWorker>(
    registration: WorkerRegistration,
    resolve: () => TWorker
): WorkerBinding => ({
    ...registration,
    resolve
});

export const workersForScope = (
    workers: readonly WorkerBinding[],
    scope: WorkerStartScope
): readonly WorkerBinding[] =>
    workers.filter((worker) => worker.scope === scope);

export const concurrencyTrackedWorkers = (
    workers: readonly WorkerBinding[]
): readonly WorkerBinding[] =>
    workers.filter((worker) => worker.tracksConcurrencyWhileRunning);
