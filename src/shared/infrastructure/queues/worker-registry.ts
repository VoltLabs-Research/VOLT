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

/**
 * Pairs a worker's runtime policy with the accessor that builds it.
 *
 * The policy sits next to the worker it governs rather than in a table the
 * bootstrap owns: `scope` and `concurrencyKey` are facts about that queue, and
 * splitting them from the class meant every new worker needed an edit in two
 * places — with nothing to catch the second one being forgotten.
 *
 * This used to push into a module-level array, so a worker joined the daemon as a
 * side effect of its file being imported — and the only thing importing those
 * files was an autoloader that walked `shared/` and `modules/` at boot. When the
 * autoloader went away the array was simply empty: every queue still accepted
 * jobs, nothing drained them, and the sole hint was a log line reading
 * `started 0 compute workers`.
 *
 * Returning a value instead makes the wiring a reference. `DAEMON_WORKERS` in
 * `@core/bootstrap/workers` names all of them, so `tsc`, the bundler and "find
 * references" can each see which workers are live, and one left out of that list
 * reads as dead code rather than as a silently idle queue.
 */
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
