import { RedisConnectionService } from './RedisConnectionService';
import { Job, Queue, QueueEvents, Worker } from 'bullmq';

export interface QueueWorkerOptions {
    concurrency?: number;
    lockDurationMs?: number;
};

interface EnqueueOptions {
    preserveExistingJob?: boolean;
};

interface QueueJobState {
    jobId: string;
    state: string | null;
    failedReason?: string;
};

interface EnqueueManyResult<T extends Record<string, unknown>> {
    enqueuedPayloads: T[];
    skippedPayloads: T[];
};

const isActiveQueueState = (state: string): boolean => {
    return state === 'active'
        || state === 'waiting'
        || state === 'delayed'
        || state === 'prioritized'
        || state === 'waiting-children';
};

export class QueueService {
    private readonly queues = new Map<string, Queue<Record<string, unknown>>>();
    private readonly queueEvents = new Map<string, QueueEvents>();

    constructor(
        private readonly redisConnectionService: RedisConnectionService
    ) {
    }

    async close(): Promise<void> {
        for (const queueEvents of this.queueEvents.values()) {
            await queueEvents.close();
        }

        for (const queue of this.queues.values()) {
            await queue.close();
        }

        this.queueEvents.clear();
        this.queues.clear();
    }

    async enqueue(queueName: string, payload: Record<string, unknown>, options: EnqueueOptions = {}): Promise<boolean> {
        const queue = this.getQueue(queueName);
        const jobId = typeof payload.jobId === 'string' ? payload.jobId : undefined;

        if (jobId && options.preserveExistingJob) {
            const existingJob = await queue.getJob(jobId);
            if (existingJob) {
                const existingState = await existingJob.getState();

                if (isActiveQueueState(existingState)) {
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

        return true;
    }

    async enqueueMany<T extends Record<string, unknown>>(
        queueName: string,
        payloads: T[],
        options: EnqueueOptions = {}
    ): Promise<EnqueueManyResult<T>> {
        const queue = this.getQueue(queueName);
        const jobsToAdd: Array<{
            name: string;
            data: T;
            opts: {
                jobId?: string;
                attempts: number;
                removeOnComplete: number;
                removeOnFail: number;
            };
        }> = [];
        const enqueuedPayloads: T[] = [];
        const skippedPayloads: T[] = [];

        for (const payload of payloads) {
            const jobId = typeof payload.jobId === 'string' ? payload.jobId : undefined;

            if (jobId && options.preserveExistingJob) {
                const existingJob = await queue.getJob(jobId);
                if (existingJob) {
                    const existingState = await existingJob.getState();

                    if (isActiveQueueState(existingState)) {
                        skippedPayloads.push(payload);
                        continue;
                    }

                    await existingJob.remove();
                }
            }

            jobsToAdd.push({
                name: queueName,
                data: payload,
                opts: {
                    jobId,
                    attempts: 1,
                    removeOnComplete: 1000,
                    removeOnFail: 1000
                }
            });
            enqueuedPayloads.push(payload);
        }

        if (jobsToAdd.length > 0) {
            await queue.addBulk(jobsToAdd);
        }

        return {
            enqueuedPayloads,
            skippedPayloads
        };
    }

    createWorker<T extends Record<string, unknown>, TResult = void>(
        queueName: string,
        processor: (payload: T, job: Job<T>) => Promise<TResult>,
        options: QueueWorkerOptions = {}
    ): Worker<T, TResult> {
        return new Worker<T, TResult>(
            queueName,
            async (job) => processor(job.data, job),
            {
                connection: this.redisConnectionService.getConnectionOptions(),
                concurrency: options.concurrency ?? 1,
                // Generous lock settings to survive GC pauses and heavy processing.
                // Default 30s is far too short — long GC mark-compact cycles (1s+)
                // cause lock renewal failures and stalled-job misdetection.
                lockDuration: options.lockDurationMs ?? 300_000,
                stalledInterval: 300_000
            }
        );
    }

    async getJobStates(queueName: string, jobIds: string[]): Promise<QueueJobState[]> {
        const queue = this.getQueue(queueName);

        return Promise.all(jobIds.map(async (jobId) => {
            const job = await queue.getJob(jobId);
            if (!job) {
                return {
                    jobId,
                    state: null
                };
            }

            return {
                jobId,
                state: await job.getState(),
                failedReason: typeof job.failedReason === 'string' && job.failedReason.length > 0
                    ? job.failedReason
                    : undefined
            };
        }));
    }

    async waitForJobCompletion<TResult>(queueName: string, jobId: string, timeoutMs = 600_000): Promise<TResult> {
        const queue = this.getQueue(queueName);
        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error(`Queue job ${jobId} was not found in ${queueName}`);
        }

        const queueEvents = this.getQueueEvents(queueName);
        const result = await job.waitUntilFinished(queueEvents, timeoutMs);
        return result as TResult;
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

    private getQueueEvents(queueName: string): QueueEvents {
        const existingQueueEvents = this.queueEvents.get(queueName);
        if (existingQueueEvents) {
            return existingQueueEvents;
        }

        const queueEvents = new QueueEvents(queueName, {
            connection: this.redisConnectionService.getConnectionOptions()
        });
        this.queueEvents.set(queueName, queueEvents);
        return queueEvents;
    }
};
