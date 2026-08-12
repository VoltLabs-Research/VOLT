import { DeferJobError } from '@shared/infrastructure/queues/queue-job-handle';
import { logger } from '@shared/infrastructure/logger';
import type { QueueJobHandle } from '@shared/infrastructure/queues/queue-job-handle';
import type { QueueWorker } from '@shared/infrastructure/queues/QueueWorker';
import type { QueuePayload, QueueService } from '@shared/infrastructure/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import type { JobIdentity } from '@shared/contracts/types/job-identity';

const SCOPE_DEFERRED_RETRY_MS = 1_000;
const SCOPE_DEFERRED_RETRY_JITTER_MS = 1_500;

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

        this.worker.on('failed', (job, error) => {
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

    setConcurrency(concurrency: number): void {
        if (!this.worker) return;

        this.worker.setConcurrency(concurrency);
    }

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
