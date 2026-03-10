import { RedisConnectionService } from './RedisConnectionService';
import { Job, Queue, Worker } from 'bullmq';

export interface QueueWorkerOptions {
    concurrency?: number;
};

export class QueueService {
    private readonly queues = new Map<string, Queue<Record<string, unknown>>>();

    constructor(
        private readonly redisConnectionService: RedisConnectionService
    ) {
    }

    async close(): Promise<void> {
        for (const queue of this.queues.values()) {
            await queue.close();
        }

        this.queues.clear();
    }

    async enqueue(queueName: string, payload: Record<string, unknown>): Promise<void> {
        const queue = this.getQueue(queueName);
        const jobId = typeof payload.jobId === 'string' ? payload.jobId : undefined;

        await queue.add(queueName, payload, {
            jobId,
            attempts: 1,
            removeOnComplete: 1000,
            removeOnFail: 1000
        });
    }

    createWorker<T extends Record<string, unknown>>(
        queueName: string,
        processor: (payload: T, job: Job<T>) => Promise<void>,
        options: QueueWorkerOptions = {}
    ): Worker<T> {
        return new Worker<T>(
            queueName,
            async (job) => processor(job.data, job),
            {
                connection: this.redisConnectionService.getConnectionOptions(),
                concurrency: options.concurrency ?? 1
            }
        );
    }

    async getJobPayload(queueName: string, jobId: string): Promise<Record<string, unknown> | null> {
        const queue = this.getQueue(queueName);
        const job = await queue.getJob(jobId);
        return job?.data || null;
    }

    async retryJob(queueName: string, jobId: string): Promise<boolean> {
        const queue = this.getQueue(queueName);
        const job = await queue.getJob(jobId);
        if (!job) {
            return false;
        }

        const state = await job.getState();
        if (state === 'failed') {
            await job.retry();
            return true;
        }

        return false;
    }

    async removeJob(queueName: string, jobId: string): Promise<boolean> {
        const queue = this.getQueue(queueName);
        const job = await queue.getJob(jobId);
        if (!job) {
            return false;
        }

        await job.remove();
        return true;
    }

    private getQueue(queueName: string): Queue<Record<string, unknown>> {
        const existingQueue = this.queues.get(queueName);
        if (existingQueue) {
            return existingQueue;
        }

        const queue = new Queue<Record<string, unknown>>(queueName, {
            connection: this.redisConnectionService.getConnectionOptions()
        });
        this.queues.set(queueName, queue);
        return queue;
    }
};
