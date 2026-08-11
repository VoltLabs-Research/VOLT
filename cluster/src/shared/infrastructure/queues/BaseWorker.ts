import { DeferJobError } from '@shared/infrastructure/queues/queue-job-handle';
import { logger } from '@shared/infrastructure/logger';
import type { QueueJobHandle } from '@shared/infrastructure/queues/queue-job-handle';
import type { QueueWorker } from '@shared/infrastructure/queues/QueueWorker';
import type { QueuePayload, QueueService } from '@shared/infrastructure/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import type { JobIdentity } from '@shared/contracts/types/job-identity';

const SCOPE_DEFERRED_RETRY_MS = 1_000;
const SCOPE_DEFERRED_RETRY_JITTER_MS = 1_500;

/* Jittered so several workers bounced off the same scope do not all come back at
   the same instant and collide again. */
const nextScopeDeferredRetryMs = (): number =>
    SCOPE_DEFERRED_RETRY_MS + Math.floor(Math.random() * SCOPE_DEFERRED_RETRY_JITTER_MS);

interface BaseWorkerDependencies {
    queueService: QueueService;
    scopeLimitsRegistry?: QueueScopeLimitsRegistry;
}

export abstract class BaseWorker<TPayload extends QueuePayload> {
    protected abstract readonly queueName: string;
    protected readonly scopeKey?: QueueScopeKey;
    private worker: QueueWorker<TPayload> | null = null;

    constructor(protected readonly baseDeps: BaseWorkerDependencies) {}

    start(concurrency = 1): void {
        if (this.worker) return;

        this.worker = this.baseDeps.queueService.createWorker<TPayload>(
            this.queueName,
            (payload, job) => this.runWithScope(payload, job),
            { concurrency }
        );

        /* Deferrals never reach here: the queue distinguishes them from failures. */
        this.worker.on('failed', (job, error) => {
            /* `err` rather than `error`: the logger only serializes an Error under
               that key, and anything else arrives as an empty object. */
            logger.error({
                err: error,
                jobId: job?.id,
                queueName: this.queueName
            }, 'Queue worker job failed');
        });

        logger.info({
            queueName: this.queueName,
            concurrency
        }, 'Queue worker started');
    }

    async stop(): Promise<void> {
        if (!this.worker) return;

        await this.worker.close();
        this.worker = null;
        logger.info({ queueName: this.queueName }, 'Queue worker stopped');
    }

    /**
     * Adjusts capacity in place.
     *
     * Slots being retired finish the job they are holding first, so lowering
     * concurrency never abandons work in flight — which is why this no longer
     * needs to drain and restart the whole worker to change the number.
     */
    setConcurrency(concurrency: number): void {
        if (!this.worker) return;

        this.worker.setConcurrency(concurrency);
    }

    /**
     * Declines the job when another job already holds this trajectory's scope.
     *
     * Deferring puts it back with a short delay rather than failing it: the job is
     * valid and simply cannot run yet, and spending a retry attempt on contention
     * would exhaust the budget of a job that never actually failed.
     */
    private async runWithScope(payload: TPayload, job: QueueJobHandle<TPayload>): Promise<void> {
        const registry = this.baseDeps.scopeLimitsRegistry;
        const scopeKey = this.scopeKey;

        if (!registry || !scopeKey) {
            return this.process(payload, job);
        }

        const { trajectoryId, analysisId } = payload as Partial<JobIdentity>;
        if (!trajectoryId) {
            return this.process(payload, job);
        }

        const release = registry.tryAcquire(scopeKey, trajectoryId, analysisId);
        if (!release) {
            await job.moveToDelayed(Date.now() + nextScopeDeferredRetryMs());
            throw new DeferJobError();
        }

        try {
            await this.process(payload, job);
        } finally {
            release();
        }
    }

    protected abstract process(payload: TPayload, job: QueueJobHandle<TPayload>): Promise<void>;
}
