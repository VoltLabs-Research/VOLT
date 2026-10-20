export class DeferJobError extends Error {
    constructor(message = 'Job deferred') {
        super(message);
        this.name = 'DeferJobError';
    }
}

interface QueueJobAttemptOptions {
    attempts?: number;
}

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
