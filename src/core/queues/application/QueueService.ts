import { Service } from '@/core/decorators/service';
import { ANALYSIS_QUEUE_NAME, ARTIFACT_UPLOAD_QUEUE_NAME, SSH_IMPORT_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME, TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import { Queue, Worker, type Job, type JobState } from 'bullmq';

export interface QueuePayload {
    jobId?: string;
}

type QueueWorkerOptions = {
    concurrency?: number;
};

type EnqueueOptions = {
    preserveExistingJob?: boolean;
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
};

type PreservedJobState = Extract<JobState, 'active' | 'waiting' | 'delayed'>;

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
    'delayed'
]);

const isPreservedJobState = (state: JobState): state is PreservedJobState => {
    return PRESERVED_JOB_STATES.has(state as PreservedJobState);
};

const KNOWN_QUEUE_NAME_SET = new Set<string>(KNOWN_QUEUE_NAMES);

@Service('queueService')
export class QueueService {
    private readonly queues = new Map<string, Queue<QueuePayload>>();
    private readonly enqueueLocks = new Map<string, Promise<unknown>>();

    constructor(
        private readonly redisConnection: RedisConnection
    ) {}

    async close(): Promise<void>{
        await Promise.all([...this.queues.values()].map((queue) => queue.close()));
        this.queues.clear();
    };

    async enqueue<T extends QueuePayload>(queueName: string, payload: T, options: EnqueueOptions = {}): Promise<boolean> {
        const jobId = payload.jobId;

        if (!jobId || !options.preserveExistingJob) {
            return this.doEnqueue(queueName, payload, options);
        }

        return this.runExclusive(`${queueName}:${jobId}`, () => this.doEnqueue(queueName, payload, options));
    }

    private async doEnqueue<T extends QueuePayload>(queueName: string, payload: T, options: EnqueueOptions): Promise<boolean> {
        const queue = this.getQueue(queueName);
        const jobId = payload.jobId;

        if (jobId && options.preserveExistingJob) {
            const existingJob = await queue.getJob(jobId);

            if (existingJob) {
                const existingState = await existingJob.getState();

                if (existingState !== 'unknown' && isPreservedJobState(existingState)) {
                    return false;
                }

                await existingJob.remove().catch(() => undefined);
            }
        }

        await queue.add(queueName, payload, {
            jobId,
            removeOnComplete: options.removeOnComplete ?? 1000,
            removeOnFail: options.removeOnFail ?? 1000
        });

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

    async enqueueBulk<T extends QueuePayload>(queueName: string, payloads: T[]): Promise<void> {
        if (payloads.length === 0) return;

        const queue = this.getQueue(queueName);

        await queue.addBulk(payloads.map((payload) => ({
            name: queueName,
            data: payload,
            opts: {
                jobId: payload.jobId,
                removeOnComplete: 1000,
                removeOnFail: 1000
            }
        })));
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
                connection: this.redisConnection.getConnectionOptions(),
                concurrency: options.concurrency,
                // Generous lock settings to survive GC pauses and heavy processing.
                // Default 30s is far too short, long GC mark-compact cycles (1s+)
                // cause lock renewal failures and stalled-job misdetection.
                lockDuration: 300_000,
                stalledInterval: 300_000
            }
        );
    };

    async retryJobById(jobId: string): Promise<boolean> {
        const job = await this.findJob(jobId);
        if(!job) return false;

        const state = await job.getState();
        if (state !== 'failed') {
            return false;
        }

        await job.retry();
        return true;
    }

    async removeJobById(jobId: string): Promise<boolean> {
        const job = await this.findJob(jobId);
        if(!job) return false;

        await job.remove();
        return true;
    }

    async findJob(jobId: string): Promise<Job<QueuePayload> | null> {
        const lookups = await Promise.all(
            KNOWN_QUEUE_NAMES.map((queueName) => this.getQueue(queueName).getJob(jobId))
        );

        return lookups.find((job): job is Job<QueuePayload> => Boolean(job)) ?? null;
    }

    private getQueue(queueName: string): Queue<QueuePayload> {
        if (!KNOWN_QUEUE_NAME_SET.has(queueName)) {
            throw new Error(`Unsupported queue: ${queueName}`);
        }

        const existingQueue = this.queues.get(queueName);
        if (existingQueue) return existingQueue;

        const queue = new Queue<QueuePayload>(queueName, {
            connection: this.redisConnection.getConnectionOptions()
        });

        this.queues.set(queueName, queue);
        return queue;
    }
};
