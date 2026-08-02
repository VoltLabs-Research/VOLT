import { singleton } from '@shared/application/utilities/singleton';
import { ANALYSIS_QUEUE_NAME, ARTIFACT_UPLOAD_QUEUE_NAME, PIPELINE_QUEUE_NAME, PLUGIN_WARMUP_QUEUE_NAME, TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME, TRAJECTORY_RASTER_QUEUE_NAME } from '@core/constants/queue-names';
import { RedisConnection, getRedisConnection } from '@shared/infrastructure/redis/RedisConnection';
import { TTLCache } from '@isaacs/ttlcache';
import { Queue, Worker, type Job, type JobState } from 'bullmq';

export interface QueuePayload {
    jobId?: string;
}

type EnqueueOptions = {
    preserveExistingJob?: boolean;
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
    attempts?: number;
    backoff?: {
        type: string;
        delay: number;
    };
};

const KNOWN_QUEUE_NAMES = [
    ANALYSIS_QUEUE_NAME,
    PIPELINE_QUEUE_NAME,
    ARTIFACT_UPLOAD_QUEUE_NAME,
    PLUGIN_WARMUP_QUEUE_NAME,
    TRAJECTORY_RASTER_QUEUE_NAME,
    TRAJECTORY_GLB_QUEUE_NAME,
    TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME
] as const;

const KNOWN_QUEUE_NAME_SET = new Set<string>(KNOWN_QUEUE_NAMES);

/** A job in one of these states is still owned by the queue, so re-enqueueing must not disturb it. */
const PRESERVED_JOB_STATES = new Set<JobState | 'unknown'>([
    'active',
    'waiting',
    'delayed'
]);

const assertKnownQueue = (queueName: string): void => {
    if (!KNOWN_QUEUE_NAME_SET.has(queueName)) {
        throw new Error(`Unsupported queue: ${queueName}`);
    }
};

const toJobOptions = (jobId: string | undefined, options: EnqueueOptions) => ({
    jobId,
    attempts: options.attempts,
    backoff: options.backoff,
    removeOnComplete: options.removeOnComplete ?? 1000,
    removeOnFail: options.removeOnFail ?? 1000
});

export class QueueService {
    private readonly queues = new Map<string, Queue<QueuePayload>>();
    private readonly enqueueLocks = new Map<string, Promise<unknown>>();
    /** Remembers which queue a job id landed in for a day, so lookups skip the fan-out scan. */
    private readonly jobQueueAffinity = new TTLCache<string, string>({
        max: 50_000,
        ttl: 86_400_000
    });

    constructor(private readonly redisConnection: RedisConnection) {}

    async close(): Promise<void> {
        await Promise.all([...this.queues.values()].map((queue) => queue.close()));
        this.queues.clear();
    }

    async enqueue<T extends QueuePayload>(queueName: string, payload: T, options: EnqueueOptions = {}): Promise<boolean> {
        const jobId = payload.jobId;
        if (!jobId || !options.preserveExistingJob) {
            return this.doEnqueue(queueName, payload, options);
        }

        // Serialised per job id only, so unrelated jobs still admit in parallel.
        return this.runExclusive(`${queueName}:${jobId}`, () => this.doEnqueue(queueName, payload, options));
    }

    private async doEnqueue<T extends QueuePayload>(queueName: string, payload: T, options: EnqueueOptions): Promise<boolean> {
        const queue = this.getQueue(queueName);
        const jobId = payload.jobId;

        if (jobId && options.preserveExistingJob) {
            const existingJob = await queue.getJob(jobId);
            if (existingJob) {
                if (PRESERVED_JOB_STATES.has(await existingJob.getState())) {
                    return false;
                }

                await existingJob.remove().catch(() => undefined);
            }
        }

        await queue.add(queueName, payload, toJobOptions(jobId, options));

        if (jobId) {
            this.jobQueueAffinity.set(jobId, queueName);
        }

        return true;
    }

    private async runExclusive<R>(key: string, task: () => Promise<R>): Promise<R> {
        const previous = this.enqueueLocks.get(key) ?? Promise.resolve();
        const next = previous.then(task, task);
        this.enqueueLocks.set(key, next);

        try {
            return await next;
        } finally {
            if (this.enqueueLocks.get(key) === next) {
                this.enqueueLocks.delete(key);
            }
        }
    }

    async enqueueBulk<T extends QueuePayload>(queueName: string, payloads: T[], options: EnqueueOptions = {}): Promise<void> {
        if (payloads.length === 0) return;

        const queue = this.getQueue(queueName);

        await queue.addBulk(payloads.map((payload) => ({
            name: queueName,
            data: payload,
            opts: toJobOptions(payload.jobId, options)
        })));

        for (const payload of payloads) {
            if (payload.jobId) {
                this.jobQueueAffinity.set(payload.jobId, queueName);
            }
        }
    }

    createWorker = <T extends QueuePayload>(
        queueName: string,
        processor: (payload: T, job: Job<T>) => Promise<void>,
        options: { concurrency?: number } = {}
    ): Worker<T> => {
        assertKnownQueue(queueName);
        return new Worker<T>(
            queueName,
            (job) => processor(job.data, job),
            {
                connection: this.redisConnection.getConnectionOptions(),
                concurrency: options.concurrency,
                lockDuration: 300_000,
                stalledInterval: 300_000
            }
        );
    };

    async retryJobById(jobId: string): Promise<boolean> {
        const job = await this.findJob(jobId);
        if (!job || (await job.getState()) !== 'failed') {
            return false;
        }

        await job.retry();
        return true;
    }

    async removeJobById(jobId: string): Promise<boolean> {
        const job = await this.findJob(jobId);
        if (!job) return false;

        await job.remove();
        return true;
    }

    private async findJob(jobId: string): Promise<Job<QueuePayload> | null> {
        const affineQueueName = this.jobQueueAffinity.get(jobId);
        if (affineQueueName) {
            const job = await this.getQueue(affineQueueName).getJob(jobId);
            if (job) return job;
        }

        const lookups = await Promise.all(
            KNOWN_QUEUE_NAMES.map((queueName) => this.getQueue(queueName).getJob(jobId))
        );

        return lookups.find((job): job is Job<QueuePayload> => Boolean(job)) ?? null;
    }

    async getJobCounts(queueName: string): Promise<{ waiting: number; active: number; delayed: number; completed: number; failed: number; }> {
        const counts = await this.getQueue(queueName).getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
        return {
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0
        };
    }

    listKnownQueueNames(): readonly string[] {
        return KNOWN_QUEUE_NAMES;
    }

    private getQueue(queueName: string): Queue<QueuePayload> {
        assertKnownQueue(queueName);
        const existingQueue = this.queues.get(queueName);
        if (existingQueue) return existingQueue;

        const queue = new Queue<QueuePayload>(queueName, {
            connection: this.redisConnection.getConnectionOptions()
        });

        this.queues.set(queueName, queue);
        return queue;
    }
}

export const getQueueService = singleton((): QueueService => new QueueService(getRedisConnection()));
