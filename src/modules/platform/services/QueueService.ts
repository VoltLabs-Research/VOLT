import { logger } from '@/core/logger';
import {
    ANALYSIS_QUEUE_NAME,
    ARTIFACT_UPLOAD_QUEUE_NAME,
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
    attempts?: number;
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
    backoff?: {
        type: 'fixed' | 'exponential';
        delay: number;
    };
};

const KNOWN_QUEUE_NAMES = [
    ANALYSIS_QUEUE_NAME,
    ARTIFACT_UPLOAD_QUEUE_NAME,
    SSH_IMPORT_QUEUE_NAME,
    TRAJECTORY_RASTER_QUEUE_NAME,
    TRAJECTORY_GLB_QUEUE_NAME
] as const;

const KNOWN_QUEUE_NAME_SET = new Set<string>(KNOWN_QUEUE_NAMES);

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

        const attempts = Number.isFinite(options.attempts) && (options.attempts ?? 0) >= 1
            ? Math.floor(options.attempts!)
            : 1;

        await queue.add(queueName, payload, {
            jobId,
            attempts,
            backoff: options.backoff,
            removeOnComplete: options.removeOnComplete ?? 1000,
            removeOnFail: options.removeOnFail ?? 1000
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

    async enqueueBulk(queueName: string, payloads: Record<string, unknown>[]): Promise<void> {
        this.assertKnownQueue(queueName);

        if (payloads.length === 0) {
            return;
        }

        const queue = this.getQueue(queueName);
        const startedAt = Date.now();

        await queue.addBulk(payloads.map((payload) => ({
            name: queueName,
            data: payload,
            opts: {
                jobId: typeof payload.jobId === 'string' ? payload.jobId : undefined,
                attempts: 1,
                removeOnComplete: 1000,
                removeOnFail: 1000
            }
        })));

        logger.info(
            {
                durationMs: Date.now() - startedAt,
                payloadCount: payloads.length,
                payloadBytes: payloads.reduce((total, payload) => total + this.measurePayloadBytes(payload), 0),
                queueName
            },
            'Enqueued queue jobs in bulk'
        );
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

    async retryJobById(jobId: string): Promise<boolean> {
        const locatedJob = await this.findJob(jobId);
        if (!locatedJob) {
            return false;
        }

        const state = await locatedJob.job.getState();
        if (state !== 'failed') {
            return false;
        }

        await locatedJob.job.retry();
        return true;
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

    async removeJobById(jobId: string): Promise<boolean> {
        const locatedJob = await this.findJob(jobId);
        if (!locatedJob) {
            return false;
        }

        await locatedJob.job.remove();
        return true;
    }

    async findJob(jobId: string): Promise<{ queueName: string; job: Job<Record<string, unknown>>; } | null> {
        for (const queueName of KNOWN_QUEUE_NAMES) {
            const job = await this.getQueue(queueName).getJob(jobId);
            if (job) {
                return {
                    queueName,
                    job
                };
            }
        }

        return null;
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
        if (!KNOWN_QUEUE_NAME_SET.has(queueName)) {
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
