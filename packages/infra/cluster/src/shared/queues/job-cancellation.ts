import { AsyncLocalStorage } from 'node:async_hooks';
import { singleton } from '@shared/utilities/singleton';

// Trajectory ids are never reused, so a purged id can stay blocked for a day without harm.
const PURGED_TRAJECTORY_TTL_MS = 86_400_000;

// Every object a trajectory owns lives under `trajectory-<id>/`, possibly below a bucket folder
// such as `plugins/`; this is the prefix the server deletes with the trajectory.
const TRAJECTORY_OBJECT_KEY_PATTERN = /(?:^|\/)trajectory-([^/]+)\//;

export class JobCancelledError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JobCancelledError';
    }
}

export interface CancellableJobScope {
    queue: string;
    jobKey: string;
    trajectoryId?: string;
}

export interface ActiveJob extends CancellableJobScope {
    readonly signal: AbortSignal;
    readonly settled: Promise<void>;
}

interface TrackedJob extends ActiveJob {
    readonly controller: AbortController;
}

const jobCancelledError = (jobKey: string): JobCancelledError =>
    new JobCancelledError(`Job ${jobKey} was cancelled`);

// Node propagates this context through every await, so code deep inside a job (an enqueue, an
// object store write) can see its job. The browser runtime's shim cannot, so nothing may depend
// on it alone: workers also hold the job's signal, and purged trajectories are checked by id.
const activeJobContext = new AsyncLocalStorage<TrackedJob>();

export class JobCancellationRegistry {
    private readonly activeJobs = new Set<TrackedJob>();
    private readonly purgedTrajectories = new Map<string, number>();

    async run<T>(scope: CancellableJobScope, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
        if (scope.trajectoryId && this.isTrajectoryPurged(scope.trajectoryId)) {
            throw jobCancelledError(scope.jobKey);
        }

        const controller = new AbortController();
        let markSettled: () => void = () => {};
        const job: TrackedJob = {
            ...scope,
            controller,
            signal: controller.signal,
            settled: new Promise<void>((resolve) => {
                markSettled = resolve;
            })
        };

        this.activeJobs.add(job);
        try {
            return await activeJobContext.run(job, () => operation(controller.signal));
        } finally {
            this.activeJobs.delete(job);
            markSettled();
        }
    }

    cancelJob(jobKey: string): ActiveJob[] {
        return this.abortMatching((job) => job.jobKey === jobKey);
    }

    // Blocks the trajectory first, so a job claimed or enqueued after this call is refused too.
    cancelTrajectory(trajectoryId: string): ActiveJob[] {
        this.prunePurgedTrajectories();
        this.purgedTrajectories.set(trajectoryId, Date.now() + PURGED_TRAJECTORY_TTL_MS);
        return this.abortMatching((job) => job.trajectoryId === trajectoryId);
    }

    isTrajectoryPurged(trajectoryId: string): boolean {
        const expiresAt = this.purgedTrajectories.get(trajectoryId);
        if (expiresAt === undefined) return false;
        if (expiresAt > Date.now()) return true;

        this.purgedTrajectories.delete(trajectoryId);
        return false;
    }

    // The signal of the running queue job a job id belongs to: the job itself, or a pipeline
    // stage `<queue job>:<analysis id>` of it.
    signalForJob(jobId: string): AbortSignal | undefined {
        for (const job of this.activeJobs) {
            if (job.jobKey === jobId || jobId.startsWith(`${job.jobKey}:`)) {
                return job.signal;
            }
        }
        return undefined;
    }

    // Resolves with how many of the jobs were still running when the timeout elapsed.
    async waitForSettled(jobs: readonly ActiveJob[], timeoutMs: number): Promise<number> {
        if (jobs.length === 0) return 0;

        const pending = new Set(jobs);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<void>((resolve) => {
            timer = setTimeout(resolve, timeoutMs);
            (timer as { unref?: () => void }).unref?.();
        });

        await Promise.race([
            Promise.all(jobs.map(async (job) => {
                await job.settled;
                pending.delete(job);
            })),
            timeout
        ]);
        clearTimeout(timer);

        return pending.size;
    }

    private abortMatching(predicate: (job: TrackedJob) => boolean): ActiveJob[] {
        const matched = [...this.activeJobs].filter(predicate);
        for (const job of matched) {
            if (!job.controller.signal.aborted) {
                job.controller.abort(jobCancelledError(job.jobKey));
            }
        }
        return matched;
    }

    private prunePurgedTrajectories(): void {
        const now = Date.now();
        for (const [trajectoryId, expiresAt] of this.purgedTrajectories) {
            if (expiresAt <= now) {
                this.purgedTrajectories.delete(trajectoryId);
            }
        }
    }
}

export const getJobCancellationRegistry = singleton((): JobCancellationRegistry => new JobCancellationRegistry());

const resolveSignal = (jobId?: string): AbortSignal | undefined =>
    activeJobContext.getStore()?.signal
    ?? (jobId ? getJobCancellationRegistry().signalForJob(jobId) : undefined);

export const throwIfAborted = (signal: AbortSignal | undefined): void => {
    if (!signal?.aborted) return;

    throw signal.reason instanceof Error ? signal.reason : new JobCancelledError('Job was cancelled');
};

export const currentJobSignal = (): AbortSignal | undefined =>
    activeJobContext.getStore()?.signal;

export const isCurrentJobCancelled = (): boolean =>
    currentJobSignal()?.aborted ?? false;

// `jobId` finds the job where the async context cannot (see activeJobContext).
export const throwIfJobCancelled = (jobId?: string): void => {
    throwIfAborted(resolveSignal(jobId));
};

// Runs the listener once if the job gets cancelled; the returned function detaches it.
export const onJobCancelled = (listener: () => void, jobId?: string): (() => void) => {
    const signal = resolveSignal(jobId);
    if (!signal) return () => {};

    if (signal.aborted) {
        listener();
        return () => {};
    }

    signal.addEventListener('abort', listener, { once: true });
    return () => signal.removeEventListener('abort', listener);
};

export const isTrajectoryPurged = (trajectoryId: string | undefined): boolean =>
    typeof trajectoryId === 'string' && getJobCancellationRegistry().isTrajectoryPurged(trajectoryId);

// Refuses a write by a cancelled job, and any write into a purged trajectory's objects,
// whoever makes it: the server deletes those objects once the purge has answered.
export const assertObjectWritable = (objectKey: string): void => {
    throwIfJobCancelled();

    const trajectoryId = TRAJECTORY_OBJECT_KEY_PATTERN.exec(objectKey)?.[1];
    if (isTrajectoryPurged(trajectoryId)) {
        throw new JobCancelledError(`Trajectory ${trajectoryId} was deleted; refusing to write ${objectKey}`);
    }
};
