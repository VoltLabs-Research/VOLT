import { Job, Worker } from 'bullmq';
import { logger } from '@/core/logger';
import type { QueuePayload, QueueService } from '@/core/queues/application/QueueService';

export interface BaseWorkerDependencies {
    queueService: QueueService;
}

export abstract class BaseWorker<TPayload extends QueuePayload> {
    protected abstract readonly queueName: string;
    private worker: Worker<TPayload> | null = null;

    constructor(protected readonly baseDeps: BaseWorkerDependencies) {}

    start(concurrency = 1): void {
        if (this.worker) return;

        this.worker = this.baseDeps.queueService.createWorker<TPayload>(
            this.queueName,
            (payload, job) => this.process(payload, job),
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
        if(!this.worker) return;

        this.worker.concurrency = Math.max(1, Math.floor(concurrency));
    }

    protected abstract process(payload: TPayload, bullJob: Job<TPayload>): Promise<void>;
}
