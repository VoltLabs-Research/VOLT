import { DelayedError, type Job, type Worker } from 'bullmq';

import { logger } from '@/core/logger';
import type { QueuePayload, QueueService } from '@/core/queues/application/QueueService';
import {
    delayJobOnQueueScopeContention,
    tryAcquireQueueScopeLease
} from '@/core/queues/infrastructure/queue-scope-lease';
import type { QueueScopeLease } from '@/core/queues/infrastructure/queue-scope-lease';
import type { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';

export interface QueueScopeConstraint {
    scope: 'trajectory' | 'team';
    scopeId: string;
    limit: number;
}

export interface BaseWorkerDependencies {
    queueService: QueueService;
    redisConnection?: RedisConnection;
}

export abstract class BaseWorker<TPayload extends QueuePayload> {
    protected abstract readonly queueName: string;

    private worker: Worker<TPayload> | null = null;

    constructor(protected readonly baseDeps: BaseWorkerDependencies) {}

    start(concurrency = 1): void {
        if (this.worker) {
            return;
        }

        this.worker = this.baseDeps.queueService.createWorker<TPayload>(
            this.queueName,
            (payload, bullJob) => this.run(payload, bullJob),
            { concurrency: Math.max(1, Math.floor(concurrency)) }
        );

        this.worker.on('failed', (job, error) => {
            logger.error(
                { jobId: job?.data?.jobId, queueName: this.queueName, err: error },
                'Queue worker job failed'
            );
        });

        logger.info({ queueName: this.queueName, concurrency }, 'Queue worker started');
    }

    async stop(): Promise<void> {
        if (!this.worker) {
            return;
        }

        await this.worker.close();
        this.worker = null;
        logger.info({ queueName: this.queueName }, 'Queue worker stopped');
    }

    setConcurrency(concurrency: number): void {
        if (this.worker) {
            this.worker.concurrency = Math.max(1, Math.floor(concurrency));
        }
    }

    protected scopeConstraints(_payload: TPayload): QueueScopeConstraint[] {
        return [];
    }

    protected abstract process(payload: TPayload, bullJob: Job<TPayload>): Promise<void>;

    private async run(payload: TPayload, bullJob: Job<TPayload>): Promise<void> {
        const lease = await this.acquireScopeLease(payload, bullJob);
        try {
            await this.process(payload, bullJob);
        } finally {
            await lease?.release();
        }
    }

    private async acquireScopeLease(payload: TPayload, bullJob: Job<TPayload>): Promise<QueueScopeLease | null> {
        const { redisConnection } = this.baseDeps;
        if (!redisConnection) {
            return null;
        }

        const constraints = this.scopeConstraints(payload);
        if (constraints.length === 0) {
            return null;
        }

        const { lease, blockingScope } = await tryAcquireQueueScopeLease(
            redisConnection,
            this.queueName,
            constraints
        );

        if (lease && !blockingScope) {
            return lease;
        }

        await delayJobOnQueueScopeContention(bullJob, {
            queueName: this.queueName,
            jobId: payload.jobId ?? 'unknown',
            scope: blockingScope ?? constraints[0]!
        });

        throw new DelayedError();
    }
}
