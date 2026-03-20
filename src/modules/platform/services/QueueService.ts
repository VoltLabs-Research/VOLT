import { logger } from '@/core/logger';
import {
    ANALYSIS_QUEUE_NAME,
    SSH_IMPORT_QUEUE_NAME,
    TRAJECTORY_GLB_QUEUE_NAME,
    TRAJECTORY_RASTER_QUEUE_NAME
} from './queue-names';
import { RedisConnectionService } from './RedisConnectionService';
import { Job, Queue, Worker } from 'bullmq';

export interface QueueWorkerOptions {
    concurrency?: number;
};

interface EnqueueOptions {
    preserveExistingJob?: boolean;
};

const KNOWN_QUEUE_NAMES = new Set<string>([
    ANALYSIS_QUEUE_NAME,
    SSH_IMPORT_QUEUE_NAME,
    TRAJECTORY_RASTER_QUEUE_NAME,
    TRAJECTORY_GLB_QUEUE_NAME
]);

const isActiveQueueState = (state: string): boolean => {
    return state === 'active'
        || state === 'waiting'
        || state === 'delayed'
        || state === 'prioritized'
        || state === 'waiting-children';
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

    async enqueue(queueName: string, payload: Record<string, unknown>, options: EnqueueOptions = {}): Promise<boolean> {
        this.assertKnownQueue(queueName);

        const queue = this.getQueue(queueName);
        const jobId = typeof payload.jobId === 'string' ? payload.jobId : undefined;
        const startedAt = Date.now();
        const payloadBytes = this.measurePayloadBytes(payload);
        let preservedExistingJob = false;

        if (jobId && options.preserveExistingJob) {
            const existingJob = await queue.getJob(jobId);
            if (existingJob) {
                preservedExistingJob = true;
                const existingState = await existingJob.getState();

                if (isActiveQueueState(existingState)) {
                    logger.info(
                        {
                            durationMs: Date.now() - startedAt,
                            jobId,
                            payloadBytes,
                            preserveExistingJob: true,
                            queueName,
                            skippedReason: 'existing-job-active'
                        },
                        'Skipped queue enqueue'
                    );
                    return false;
                }

                await existingJob.remove();
            }
        }

        await queue.add(queueName, payload, {
            jobId,
            attempts: 1,
            removeOnComplete: 1000,
            removeOnFail: 1000
        });

        logger.info(
            {
                durationMs: Date.now() - startedAt,
                jobId,
                payloadBytes,
                preserveExistingJob: options.preserveExistingJob ?? false,
                queueName,
                replacedExistingJob: preservedExistingJob
            },
            'Enqueued queue job'
        );

        return true;
    }

    createWorker<T extends Record<string, unknown>>(
        queueName: string,
        processor: (payload: T, job: Job<T>) => Promise<void>,
        options: QueueWorkerOptions = {}
    ): Worker<T> {
        this.assertKnownQueue(queueName);

        return new Worker<T>(
            queueName,
            async (job) => processor(job.data, job),
            {
                connection: this.redisConnectionService.getConnectionOptions(),
                concurrency: options.concurrency ?? 1,
                // Generous lock settings to survive GC pauses and heavy processing.
                // Default 30s is far too short — long GC mark-compact cycles (1s+)
                // cause lock renewal failures and stalled-job misdetection.
                lockDuration: 300_000,
                stalledInterval: 300_000
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
        this.assertKnownQueue(queueName);

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

    private assertKnownQueue(queueName: string): void {
        if (!KNOWN_QUEUE_NAMES.has(queueName)) {
            throw new Error(`Unsupported queue: ${queueName}`);
        }
    }

    private measurePayloadBytes(payload: Record<string, unknown>): number {
        try {
            return Buffer.byteLength(JSON.stringify(payload));
        } catch {
            return -1;
        }
    }
};
