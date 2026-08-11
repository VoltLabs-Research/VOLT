/**
 * Thrown to unwind out of a processor that has already put its job back.
 *
 * It is not a failure: the worker recognises it and leaves the job alone rather
 * than spending an attempt on it.
 */
export class DeferJobError extends Error {
    constructor(message = 'Job deferred') {
        super(message);
        this.name = 'DeferJobError';
    }
}

/** The attempt budget, as the processor sees it. */
interface QueueJobAttemptOptions {
    attempts?: number;
}

/**
 * What a processor sees of the job it is running.
 *
 * Deliberately the subset of the queue row that processors were already using, so
 * the queue's own bookkeeping — leases, stall counts, backoff — stays out of
 * reach of the code doing the work.
 */
export interface QueueJobHandle<TPayload> {
    id: string;
    name: string;
    data: TPayload;
    attemptsMade: number;
    opts: QueueJobAttemptOptions;
    moveToDelayed(untilEpochMs: number): Promise<void>;
}

interface QueueJobHandleContext<TPayload> {
    id: string;
    queue: string;
    payload: TPayload;
    attemptsMade: number;
    maxAttempts: number;
    onDefer: (runAt: Date) => Promise<void>;
}

export const createQueueJobHandle = <TPayload>(
    context: QueueJobHandleContext<TPayload>
): QueueJobHandle<TPayload> => ({
    id: context.id,
    name: context.queue,
    data: context.payload,
    attemptsMade: context.attemptsMade,
    opts: { attempts: context.maxAttempts },
    moveToDelayed: (untilEpochMs) => context.onDefer(new Date(untilEpochMs))
});
