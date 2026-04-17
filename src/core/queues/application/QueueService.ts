import { logger } from '@/core/logger';
import { ANALYSIS_QUEUE_NAME, ARTIFACT_UPLOAD_QUEUE_NAME, SSH_IMPORT_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME, TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { RedisConnectionService } from '@/core/storage/infrastructure/redis/RedisConnectionService';
import { Queue, Worker, type Job, type JobState } from 'bullmq';

export interface QueuePayload {
    jobId?: string;
}

type QueueWorkerOptions = {
    concurrency?: number;
};

type QueueBackoffOptions = {
    type: 'fixed' | 'exponential';
    delay: number;
};

type EnqueueOptions = {
    preserveExistingJob?: boolean;
    attempts?: number;
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
    backoff?: QueueBackoffOptions;
};

type PreservedJobState = Extract<JobState, 'active' | 'waiting' | 'delayed' | 'prioritized' | 'waiting-children'>;

const KNOWN_QUEUE_NAMES = [
    ANALYSIS_QUEUE_NAME,
    ARTIFACT_UPLOAD_QUEUE_NAME,
    SSH_IMPORT_QUEUE_NAME,
    TRAJECTORY_RASTER_QUEUE_NAME,
    TRAJECTORY_GLB_QUEUE_NAME
] as const;

const PRESERVED_JOB_STATES = new Set<PreservedJobState>([
    'active',
    'waiting',
    'delayed',
    'prioritized',
    'waiting-children'
]);

const KNOWN_QUEUE_NAME_SET = new Set<string>(KNOWN_QUEUE_NAMES);

export class QueueService {
    private readonly queues = new Map<string, Queue<QueuePayload>>();

    constructor(
        private readonly redisConnectionService: RedisConnectionService
    ) {
    }

    close = async (): Promise<void> => {
        for (const queue of this.queues.values()) {
            await queue.close();
        }

        this.queues.clear();
    };

    async enqueue<T extends QueuePayload>(queueName: string, payload: T, options: EnqueueOptions = {}): Promise<boolean> {
        const queue = this.getQueue(queueName);
        const jobId = payload.jobId;
        const startedAt = Date.now();
        const payloadBytes = this.measurePayloadBytes(payload);
        let preservedExistingJob = false;

        if (jobId && options.preserveExistingJob) {
            const existingJob = await queue.getJob(jobId);
            if (existingJob) {
                preservedExistingJob = true;
                const existingState = await existingJob.getState();

                if (existingState !== 'unknown' && PRESERVED_JOB_STATES.has(existingState)) {
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

        const attempts = options.attempts ?? 1;

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
                preserveExistingJob: options.preserveExistingJob === true,
                queueName,
                replacedExistingJob: preservedExistingJob
            },
            'Enqueued queue job'
        );

        return true;
    }

    async enqueueBulk<T extends QueuePayload>(queueName: string, payloads: T[]): Promise<void> {
        if (payloads.length === 0) {
            return;
        }

        const queue = this.getQueue(queueName);
        const startedAt = Date.now();

        await queue.addBulk(payloads.map((payload) => ({
            name: queueName,
            data: payload,
            opts: {
                jobId: payload.jobId,
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

    createWorker = <T extends QueuePayload>(
        queueName: string,
        processor: (payload: T, job: Job<T>) => Promise<void>,
        options: QueueWorkerOptions = {}
    ): Worker<T> => {
        if (!KNOWN_QUEUE_NAME_SET.has(queueName)) {
            throw new Error(`Unsupported queue: ${queueName}`);
        }

        return new Worker<T>(
            queueName,
            (job) => processor(job.data, job),
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
    };

    async retryJobById(jobId: string): Promise<boolean> {
        const job = await this.findJob(jobId);
        if (!job) {
            return false;
        }

        const state = await job.getState();
        if (state !== 'failed') {
            return false;
        }

        await job.retry();
        return true;
    }

    async removeJobById(jobId: string): Promise<boolean> {
        const job = await this.findJob(jobId);
        if (!job) {
            return false;
        }

        await job.remove();
        return true;
    }

    async findJob(jobId: string): Promise<Job<QueuePayload> | null> {
        for (const queueName of KNOWN_QUEUE_NAMES) {
            const job = await this.getQueue(queueName).getJob(jobId);
            if (job) {
                return job;
            }
        }

        return null;
    }

    private getQueue(queueName: string): Queue<QueuePayload> {
        if (!KNOWN_QUEUE_NAME_SET.has(queueName)) {
            throw new Error(`Unsupported queue: ${queueName}`);
        }

        const existingQueue = this.queues.get(queueName);
        if (existingQueue) {
            return existingQueue;
        }

        const queue = new Queue<QueuePayload>(queueName, {
            connection: this.redisConnectionService.getConnectionOptions()
        });
        this.queues.set(queueName, queue);
        return queue;
    }

    private measurePayloadBytes(payload: object): number {
        try {
            return Buffer.byteLength(JSON.stringify(payload));
        } catch {
            return -1;
        }
    }
};
