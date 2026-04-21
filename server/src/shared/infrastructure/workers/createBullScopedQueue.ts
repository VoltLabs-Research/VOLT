import logger from '@shared/infrastructure/logger';
import {
    delayJobOnQueueScopeContention,
    tryAcquireQueueScopeLease,
    type QueueScopeConstraint,
    type QueueScopeLease
} from '@modules/trajectory/infrastructure/services/trajectory/queue-scope-lease';
import {
    DelayedError,
    Queue,
    Worker,
    type BulkJobOptions,
    type Job,
    type QueueOptions,
    type WorkerOptions
} from 'bullmq';
import type IORedis from 'ioredis';

/**
 * Standard BullMQ `defaultJobOptions` used by trajectory background queues.
 */
export const DEFAULT_BULL_SCOPED_QUEUE_JOB_OPTIONS = {
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 }
} as const;

/**
 * Function that resolves the scope-lease constraints for a given BullMQ job
 * at runtime. Returning an empty array disables scope gating for that job.
 */
export type ScopeLeaseResolver<TJobData> = (
    job: Job<TJobData>
) => Promise<QueueScopeConstraint[]>;

/**
 * Options driving scope-lease acquisition around every job in a queue.
 * `resolveFallbackScope` is used to report a scope to
 * `delayJobOnQueueScopeContention` when the lease acquire returned no
 * explicit `blockingScope`.
 */
export interface BullScopedQueueLeaseOptions<TJobData> {
    redis: IORedis;
    resolveConstraints: ScopeLeaseResolver<TJobData>;
    resolveFallbackScope?: (job: Job<TJobData>) => QueueScopeConstraint | null;
}

export interface BullScopedQueueOptions<TJobData, TResult> {
    /** Unique queue name (also used as BullMQ queue + worker name). */
    name: string;
    /** Tag used on log lines emitted by the helper (e.g. `@cloud-upload-queue`). */
    logTag: string;
    /** BullMQ connection options builder invoked once per `start()`. */
    redisConnectionFactory: () => QueueOptions['connection'];
    /** Worker concurrency. */
    concurrency: number;
    /**
     * Business logic executed inside the scope-lease. Anything throwing here
     * is treated as a job failure by BullMQ (same semantics as a raw worker).
     */
    processor: (job: Job<TJobData>) => Promise<TResult>;
    /** Optional scope-lease gating. When omitted the processor runs unguarded. */
    scopeLease?: BullScopedQueueLeaseOptions<TJobData>;
    /** Invoked after a job completes (errors inside are logged, never thrown). */
    onJobCompleted?: (job: Job<TJobData, TResult>, result: TResult) => Promise<void> | void;
    /** Invoked after a job finally fails (DelayedError is filtered out). */
    onJobFailed?: (job: Job<TJobData>, error: Error) => Promise<void> | void;
    /** Optional extra queue options merged on top of the sane defaults. */
    queueOptions?: Omit<QueueOptions, 'connection'>;
    /** Optional extra worker options merged on top of the sane defaults. */
    workerOptions?: Omit<WorkerOptions, 'connection' | 'concurrency'>;
}

export interface BullScopedQueueHandle<TJobData, TResult> {
    readonly queue: Queue<TJobData, TResult>;
    readonly worker: Worker<TJobData, TResult>;
    addBulk(
        entries: Array<{ name: string; data: TJobData; opts?: BulkJobOptions }>
    ): Promise<void>;
    close(): Promise<void>;
}

export interface BullScopedQueueController<TJobData, TResult> {
    start(): void;
    getHandle(): BullScopedQueueHandle<TJobData, TResult> | null;
    requireHandle(): BullScopedQueueHandle<TJobData, TResult>;
    close(): Promise<void>;
}

/**
 * Factory returning a lazily-initialised BullMQ queue + worker tuple that
 * shares the following plumbing across trajectory background queues:
 *
 *   - Common `defaultJobOptions` (removeOnComplete/removeOnFail limits)
 *   - Queue-scope lease acquire/release around every job
 *   - `DelayedError` filtering in the `failed` listener
 *   - Listener error containment (never crashes the worker)
 *   - Graceful shutdown of worker then queue
 *
 * The returned controller is idempotent on `start()`/`close()` via an internal guard.
 */
export const createBullScopedQueue = <TJobData extends object, TResult>(
    options: BullScopedQueueOptions<TJobData, TResult>
): BullScopedQueueController<TJobData, TResult> => {
    let handle: BullScopedQueueHandle<TJobData, TResult> | null = null;

    const runListenerStep = async (
        action: string,
        operation: () => Promise<void> | void
    ): Promise<void> => {
        try {
            await operation();
        } catch (error) {
            logger.error(error, `${options.logTag}: failed to ${action}`);
        }
    };

    const runJobWithScopeLease = async (job: Job<TJobData>): Promise<TResult> => {
        if (!options.scopeLease) {
            return options.processor(job);
        }

        const scopeLease = options.scopeLease;
        let lease: QueueScopeLease | null = null;

        try {
            const constraints = await scopeLease.resolveConstraints(job);

            const { lease: acquiredLease, blockingScope } = await tryAcquireQueueScopeLease(
                scopeLease.redis,
                options.name,
                constraints
            );
            lease = acquiredLease;

            if (!lease || blockingScope) {
                const fallbackScope = scopeLease.resolveFallbackScope?.(job) ?? null;
                const scopeForDelay = blockingScope ?? fallbackScope;
                if (!scopeForDelay) {
                    throw new Error(
                        `${options.logTag}: scope lease contention with no resolvable scope for job ${job.id ?? 'unknown'}`
                    );
                }
                await delayJobOnQueueScopeContention(job, {
                    queueName: options.name,
                    jobId: String(job.id ?? ''),
                    scope: scopeForDelay
                });
            }

            return await options.processor(job);
        } finally {
            if (lease) {
                await lease.release();
            }
        }
    };

    const start = (): void => {
        if (handle) return;

        const connection = options.redisConnectionFactory();

        const queue = new Queue<TJobData, TResult>(options.name, {
            connection,
            defaultJobOptions: { ...DEFAULT_BULL_SCOPED_QUEUE_JOB_OPTIONS },
            ...options.queueOptions
        });

        const worker = new Worker<TJobData, TResult>(
            options.name,
            async (job) => runJobWithScopeLease(job),
            {
                connection,
                concurrency: options.concurrency,
                removeOnComplete: { count: 500 },
                removeOnFail: { count: 200 },
                ...options.workerOptions
            }
        );

        if (options.onJobCompleted) {
            worker.on('completed', async (job, result) => {
                await runListenerStep('run onJobCompleted handler', async () => {
                    await options.onJobCompleted!(job, result);
                });
            });
        }

        worker.on('failed', async (job, error) => {
            if (!job) return;
            if (error instanceof DelayedError) return;

            if (options.onJobFailed) {
                await runListenerStep('run onJobFailed handler', async () => {
                    await options.onJobFailed!(job, error);
                });
            }
        });

        worker.on('error', (error) => {
            logger.error(error, `${options.logTag}: worker error`);
        });

        handle = {
            queue,
            worker,
            async addBulk(entries) {
                await queue.addBulk(entries as Parameters<typeof queue.addBulk>[0]);
            },
            async close(): Promise<void> {
                await worker.close();
                await queue.close();
            }
        };
    };

    const close = async (): Promise<void> => {
        if (!handle) return;
        const current = handle;
        handle = null;
        await current.close();
        logger.info(`${options.logTag}: stopped`);
    };

    return {
        start,
        getHandle: () => handle,
        requireHandle: () => {
            if (!handle) {
                throw new Error(`${options.logTag}: queue has not been started`);
            }
            return handle;
        },
        close
    };
};
