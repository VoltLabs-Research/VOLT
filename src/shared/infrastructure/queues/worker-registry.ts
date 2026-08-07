import type { TeamClusterDaemonQueueConcurrency } from '@shared/contracts/types/team-cluster-runtime';

/**
 * When a worker is allowed to run.
 *
 * `always` workers serve the trajectory pipeline every daemon owes its cluster;
 * `compute` workers only run where the control plane has granted the compute role.
 */
export type WorkerStartScope = 'always' | 'compute';

/** What the coordinator needs of a worker, independent of which queue it drains. */
export interface ManagedWorker {
    start(concurrency: number): void;
    stop(): Promise<void>;
    setConcurrency(concurrency: number): void;
}

export interface WorkerRegistration {
    name: string;
    scope: WorkerStartScope;
    concurrencyKey: keyof TeamClusterDaemonQueueConcurrency;
    /**
     * Whether the control plane may retune this worker while it is running, as
     * opposed to only at start.
     */
    tracksConcurrencyWhileRunning: boolean;
}

export interface WorkerBinding extends WorkerRegistration {
    resolve: () => ManagedWorker;
}

const registered: WorkerBinding[] = [];

/**
 * Declares a worker and its runtime policy, returning the accessor unchanged.
 *
 * The policy sits next to the worker it governs rather than in a table the
 * bootstrap owns: `scope` and `concurrencyKey` are facts about that queue, and
 * splitting them from the class meant every new worker needed an edit in two
 * places — with nothing to catch the second one being forgotten.
 *
 * Wrapping the accessor's declaration is what makes registration unmissable; a
 * worker that is written but never registered would simply never start.
 */
export const registerDaemonWorker = <TWorker extends ManagedWorker>(
    registration: WorkerRegistration,
    resolve: () => TWorker
): (() => TWorker) => {
    registered.push({
        ...registration,
        resolve
    });

    return resolve;
};

export const workersForScope = (scope: WorkerStartScope): readonly WorkerBinding[] =>
    registered.filter((worker) => worker.scope === scope);

export const concurrencyTrackedWorkers = (): readonly WorkerBinding[] =>
    registered.filter((worker) => worker.tracksConcurrencyWhileRunning);
