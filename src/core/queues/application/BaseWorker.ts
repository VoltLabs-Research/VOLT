import { DelayedError, Job, Worker } from 'bullmq';
import { logger } from '@/core/logger';
import type { QueuePayload, QueueService } from '@/core/queues/application/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import type { JobIdentity } from '@/support/contracts/job-identity';
import { logAndSwallow } from '@/support/error/errorMessage';

const SCOPE_DEFERRED_RETRY_MS = 500;

export interface BaseWorkerDependencies {
    queueService: QueueService;
    scopeLimitsRegistry?: QueueScopeLimitsRegistry;
}

export abstract class BaseWorker<TPayload extends QueuePayload> {
    protected abstract readonly queueName: string;
    protected readonly scopeKey?: QueueScopeKey;
    private worker: Worker<TPayload> | null = null;

    constructor(protected readonly baseDeps: BaseWorkerDependencies) {}

    start(concurrency = 1): void {
        if (this.worker) return;

        this.worker = this.baseDeps.queueService.createWorker<TPayload>(
            this.queueName,
            (payload, job) => this.runWithScope(payload, job),
            { concurrency }
        );

        this.worker.on('failed', (job, error) => {
            logger.error({ job, error }, 'Queue worker job failed');
        });

        logger.info({ queueName: this.queueName, concurrency }, 'Queue worker started');
    }

    async stop(): Promise<void> {
        if (!this.worker) return;

        await this.worker.close();
        this.worker = null;
        logger.info({ queueName: this.queueName }, 'Queue worker stopped');
    }

    setConcurrency(concurrency: number): void {
        if (!this.worker) return;

        const next = Math.max(1, Math.floor(concurrency));
        if (this.worker.concurrency === next) return;

        // BullMQ's concurrency setter only mutates the internal value; it does not
        // activate idle slots until a running job completes. When the user raises
        // the limit we need the new slots available immediately, so drain the old
        // worker in the background and spin up a fresh one bound to the same queue.
        const draining = this.worker;
        this.worker = null;
        void draining.close().catch(
            logAndSwallow('warn', { queueName: this.queueName }, 'Queue worker drain after concurrency change failed')
        );
        this.start(next);
    }

    private async runWithScope(payload: TPayload, bullJob: Job<TPayload>): Promise<void> {
        const registry = this.baseDeps.scopeLimitsRegistry;
        const scopeKey = this.scopeKey;

        if (!registry || !scopeKey) {
            return this.process(payload, bullJob);
        }

        const { trajectoryId, teamId } = payload as Partial<JobIdentity>;
        if (!trajectoryId && !teamId) {
            return this.process(payload, bullJob);
        }

        const release = registry.tryAcquire(scopeKey, trajectoryId, teamId);
        if (!release) {
            await bullJob.moveToDelayed(Date.now() + SCOPE_DEFERRED_RETRY_MS, bullJob.token);
            throw new DelayedError();
        }

        try {
            await this.process(payload, bullJob);
        } finally {
            release();
        }
    }

    protected abstract process(payload: TPayload, bullJob: Job<TPayload>): Promise<void>;
}
