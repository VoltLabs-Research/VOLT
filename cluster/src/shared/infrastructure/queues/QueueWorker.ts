import { randomUUID } from 'node:crypto';
import { logger } from '@shared/infrastructure/logger';
import { getQueueNotifier } from '@shared/infrastructure/queues/QueueNotifier';
import { DeferJobError, createQueueJobHandle } from '@shared/infrastructure/queues/queue-job-handle';
import { claimNextJob, completeJob, deferJob, failJob, renewLease } from '@shared/infrastructure/queues/queue-job-store';
import type { QueueJobHandle } from '@shared/infrastructure/queues/queue-job-handle';
import type { QueueJob, QueueJobState } from '@shared/infrastructure/queues/queue-job-model';

type QueueJobProcessor<TPayload> = (payload: TPayload, job: QueueJobHandle<TPayload>) => Promise<void>;

type QueueWorkerFailedListener = (job: QueueJobHandle<unknown> | null, error: Error) => void;

interface QueueWorkerOptions {
    concurrency: number;
    leaseDurationMs: number;
    pollIntervalMs: number;
}

/** A lease is renewed well inside its window so one slow tick cannot lose the job. */
const LEASE_RENEWAL_DIVISOR = 3;

interface Slot {
    id: string;
    stopRequested: boolean;
    finished: Promise<void>;
}

/**
 * Pulls jobs from one queue and runs them.
 *
 * Concurrency is N independent slots rather than one loop fetching N jobs at a
 * time. With batching, a slot cannot start its next job until the slowest job in
 * its batch finishes, which for compute that ranges from seconds to minutes per
 * frame idles most of the capacity. Independent slots keep every one of them busy.
 */
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

    /** Resolves once every slot has finished the job it was holding. */
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

        /*
         * Shrinking asks slots to retire after their current job rather than
         * cancelling: a compute job may be minutes into a native binary, and
         * abandoning it would leave the lease to lapse and the work to repeat.
         */
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
                claimed = await claimNextJob(this.queue, slot.id, this.options.leaseDurationMs);
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

        const handle = createQueueJobHandle<TPayload>({
            id: claimed.id,
            queue: this.queue,
            payload: claimed.payload as TPayload,
            attemptsMade: claimed.attemptsMade,
            maxAttempts: claimed.maxAttempts,
            onDefer: async (runAt) => {
                deferred = true;
                await deferJob(claimed.id, runAt);
            }
        });

        const renewal = setInterval(() => {
            void renewLease(claimed.id, slot.id, this.options.leaseDurationMs).then((held) => {
                if (held) return;

                /* The job was reclaimed, so another slot may already be running it. */
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

        try {
            await this.processor(claimed.payload as TPayload, handle);

            if (!deferred) {
                await completeJob(claimed.id);
            }
        } catch (error) {
            if (deferred || error instanceof DeferJobError) {
                return;
            }

            const failure = error instanceof Error ? error : new Error(String(error));
            let state: QueueJobState | null = null;
            try {
                state = await failJob(claimed.id, failure.message);
            } catch (recordError) {
                logger.error({
                    err: recordError,
                    queue: this.queue,
                    jobId: claimed.id
                }, '@queue-worker: could not record job failure; job may remain active');
            }

            for (const listener of this.failedListeners) {
                try {
                    listener(handle as QueueJobHandle<unknown>, failure);
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

    private pause(): Promise<void> {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, this.options.pollIntervalMs);
            timer.unref();
        });
    }
}
