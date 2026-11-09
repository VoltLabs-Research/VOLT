import { randomUUID } from 'node:crypto';
import { logger } from '@shared/logger';
import { getQueueNotifier } from '@shared/queues/QueueNotifier';
import { DeferJobError, createQueueJobHandle } from '@shared/queues/queue-job-handle';
import { getQueueJobStore } from '@shared/queues/queue-job-store';
import { JobCancelledError, getJobCancellationRegistry } from '@shared/queues/job-cancellation';
import type { QueueJobHandle } from '@shared/queues/queue-job-handle';
import type { QueueJob, QueueJobState } from '@shared/queues/queue-job-model';
import type { JsonObject } from '@shared/contracts/types/json';

type QueueJobProcessor<TPayload> = (payload: TPayload, job: QueueJobHandle<TPayload>) => Promise<void>;

type QueueWorkerFailedListener = (job: QueueJobHandle<unknown> | null, error: Error) => void;

const readTrajectoryId = (payload: JsonObject): string | undefined =>
    typeof payload.trajectoryId === 'string' && payload.trajectoryId.length > 0
        ? payload.trajectoryId
        : undefined;

interface QueueWorkerOptions {
    concurrency: number;
    leaseDurationMs: number;
    pollIntervalMs: number;
}

const LEASE_RENEWAL_DIVISOR = 3;

interface Slot {
    id: string;
    stopRequested: boolean;
    finished: Promise<void>;
}

export class QueueWorker<TPayload> {
    private readonly slots = new Set<Slot>();
    private readonly failedListeners: QueueWorkerFailedListener[] = [];
    private targetConcurrency: number;
    private closing = false;

    constructor(
        private readonly queue: string,
        private readonly processor: QueueJobProcessor<TPayload>,
        private readonly options: QueueWorkerOptions
    ) {
        this.targetConcurrency = Math.max(1, Math.floor(options.concurrency));
        this.scaleToTarget();
    }

    get concurrency(): number {
        return this.targetConcurrency;
    }

    on(event: 'failed', listener: QueueWorkerFailedListener): this {
        if (event === 'failed') this.failedListeners.push(listener);
        return this;
    }

    setConcurrency(concurrency: number): void {
        if (this.closing) return;

        this.targetConcurrency = Math.max(1, Math.floor(concurrency));
        this.scaleToTarget();
    }

    async close(): Promise<void> {
        this.closing = true;

        const running = [...this.slots];
        for (const slot of running) slot.stopRequested = true;

        await Promise.all(running.map((slot) => slot.finished));
        this.slots.clear();
    }

    private scaleToTarget(): void {
        while (this.slots.size < this.targetConcurrency && !this.closing) {
            this.spawnSlot();
        }

        const excess = this.slots.size - this.targetConcurrency;
        if (excess <= 0) return;

        for (const slot of [...this.slots].slice(-excess)) {
            slot.stopRequested = true;
        }
    }

    private spawnSlot(): void {
        const slot: Slot = {
            id: `${this.queue}:${randomUUID()}`,
            stopRequested: false,
            finished: Promise.resolve()
        };

        slot.finished = this.runSlot(slot).finally(() => {
            this.slots.delete(slot);
        });

        this.slots.add(slot);
    }

    private async runSlot(slot: Slot): Promise<void> {
        while (!slot.stopRequested && !this.closing) {
            let claimed;
            try {
                claimed = await getQueueJobStore().claimNextJob(this.queue, slot.id, this.options.leaseDurationMs);
            } catch (error) {
                logger.error({
                    err: error,
                    queue: this.queue
                }, '@queue-worker: claim failed');

                await this.pause();
                continue;
            }

            if (!claimed) {
                await getQueueNotifier().waitForWork(this.queue, this.options.pollIntervalMs);
                continue;
            }

            await this.runClaimedJob(slot, claimed);
        }
    }

    private async runClaimedJob(slot: Slot, claimed: QueueJob): Promise<void> {
        let deferred = false;
        let handle: QueueJobHandle<TPayload> | null = null;

        const renewal = setInterval(() => {
            void getQueueJobStore().renewLease(claimed.id, slot.id, this.options.leaseDurationMs).then((held) => {
                if (held) return;

                logger.warn({
                    queue: this.queue,
                    jobId: claimed.id
                }, '@queue-worker: lease lost while job was still running');
            }).catch((renewalError: unknown) => {
                logger.error({
                    err: renewalError,
                    queue: this.queue,
                    jobId: claimed.id
                }, '@queue-worker: lease renewal failed');
            });
        }, Math.max(1_000, Math.floor(this.options.leaseDurationMs / LEASE_RENEWAL_DIVISOR)));
        renewal.unref();

        let cancelled = false;
        try {
            await getJobCancellationRegistry().run(
                {
                    queue: this.queue,
                    jobKey: claimed.jobKey,
                    trajectoryId: readTrajectoryId(claimed.payload)
                },
                async (signal) => {
                    handle = createQueueJobHandle<TPayload>({
                        id: claimed.id,
                        queue: this.queue,
                        payload: claimed.payload as TPayload,
                        attemptsMade: claimed.attemptsMade,
                        maxAttempts: claimed.maxAttempts,
                        signal,
                        onDefer: async (runAt) => {
                            deferred = true;
                            await getQueueJobStore().deferJob(claimed.id, runAt);
                        }
                    });

                    try {
                        await this.processor(claimed.payload as TPayload, handle);
                    } finally {
                        cancelled = signal.aborted;
                    }
                }
            );

            if (cancelled) {
                await this.discardCancelledJob(claimed);
                return;
            }

            if (!deferred) {
                await getQueueJobStore().completeJob(claimed.id);
            }
        } catch (error) {
            if (deferred || error instanceof DeferJobError) {
                return;
            }

            if (cancelled || error instanceof JobCancelledError) {
                await this.discardCancelledJob(claimed);
                return;
            }

            const failure = error instanceof Error ? error : new Error(String(error));
            let state: QueueJobState | null = null;
            try {
                state = await getQueueJobStore().failJob(claimed.id, failure.message);
            } catch (recordError) {
                logger.error({
                    err: recordError,
                    queue: this.queue,
                    jobId: claimed.id
                }, '@queue-worker: could not record job failure; job may remain active');
            }

            for (const listener of this.failedListeners) {
                try {
                    listener(handle as QueueJobHandle<unknown> | null, failure);
                } catch (listenerError) {
                    logger.error({ err: listenerError }, '@queue-worker: failed listener threw');
                }
            }

            if (state === 'delayed') {
                logger.warn({
                    queue: this.queue,
                    jobId: claimed.id,
                    attemptsMade: claimed.attemptsMade
                }, '@queue-worker: job failed and will retry');
            }
        } finally {
            clearInterval(renewal);
        }
    }

    // Whoever cancelled the job normally removed its row already; this covers the rest,
    // so a cancelled job is never retried or reported as failed.
    private async discardCancelledJob(claimed: QueueJob): Promise<void> {
        logger.info({
            queue: this.queue,
            jobId: claimed.id,
            jobKey: claimed.jobKey
        }, '@queue-worker: job cancelled');

        try {
            await getQueueJobStore().discardJob(claimed.id);
        } catch (error) {
            logger.error({
                err: error,
                queue: this.queue,
                jobId: claimed.id
            }, '@queue-worker: could not discard cancelled job');
        }
    }

    private pause(): Promise<void> {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, this.options.pollIntervalMs);
            timer.unref();
        });
    }
}
