import { ConnectionOptions, Job as BullJob, JobProgress, Queue, Worker } from 'bullmq';
import logger from '@shared/infrastructure/logger';
import {
    MAX_RETRIES,
    QueueJobData,
    RETRY_BACKOFF_MS,
    STATUS_TTL_SECONDS,
    STALLED_INTERVAL_MS
} from '@modules/jobs/infrastructure/services/ProcessingQueueShared';

interface ProcessingQueueRuntimeConfig {
    queueName: string;
    workerPath: string;
    maxConcurrentJobs: number;
    connection: ConnectionOptions;
}

interface ProcessingQueueRuntimeListeners {
    onActive: (bullJob: BullJob) => Promise<void>;
    onProgress: (bullJob: BullJob, progress: JobProgress) => Promise<void>;
    onCompleted: (bullJob: BullJob) => Promise<void>;
    onFailed: (bullJob: BullJob | undefined, error: Error) => Promise<void>;
}

export interface QueueBulkJob {
    name: string;
    data: QueueJobData;
    opts: {
        jobId: string;
    };
}

export default class ProcessingQueueRuntime {
    private readonly bullQueue: Queue;
    private readonly bullWorker: Worker;

    constructor(
        private readonly config: ProcessingQueueRuntimeConfig,
        listeners: ProcessingQueueRuntimeListeners
    ) {
        this.bullQueue = new Queue(this.config.queueName, {
            connection: this.config.connection,
            defaultJobOptions: {
                attempts: MAX_RETRIES,
                backoff: {
                    type: 'exponential',
                    delay: RETRY_BACKOFF_MS
                },
                removeOnComplete: {
                    age: STATUS_TTL_SECONDS,
                    count: 1000
                },
                removeOnFail: {
                    age: STATUS_TTL_SECONDS,
                    count: 5000
                }
            }
        });

        this.bullWorker = new Worker(
            this.config.queueName,
            this.config.workerPath,
            {
                connection: this.config.connection,
                concurrency: this.config.maxConcurrentJobs,
                stalledInterval: STALLED_INTERVAL_MS,
                removeOnComplete: { count: 1000 },
                removeOnFail: { count: 5000 }
            }
        );

        this.attachWorkerListeners(listeners);
    }

    async addBulk(jobs: QueueBulkJob[]): Promise<void> {
        await this.bullQueue.addBulk(jobs);
    }

    async getJob(jobId: string): Promise<BullJob | undefined | null> {
        return this.bullQueue.getJob(jobId);
    }

    async close(): Promise<void> {
        await this.bullWorker.close();
        await this.bullQueue.close();
    }

    private attachWorkerListeners(listeners: ProcessingQueueRuntimeListeners): void {
        this.bullWorker.on('active', async (bullJob: BullJob) => {
            try {
                await listeners.onActive(bullJob);
            } catch (error) {
                logger.error(error, `[${this.config.queueName}] Unhandled error in onJobActive for job ${bullJob.data?.jobId}`);
            }
        });

        this.bullWorker.on('progress', async (bullJob: BullJob, progress: JobProgress) => {
            try {
                await listeners.onProgress(bullJob, progress);
            } catch (error) {
                logger.error(error, `[${this.config.queueName}] Unhandled error in onJobProgress for job ${bullJob.data?.jobId}`);
            }
        });

        this.bullWorker.on('completed', async (bullJob: BullJob) => {
            try {
                await listeners.onCompleted(bullJob);
            } catch (error) {
                logger.error(error, `[${this.config.queueName}] Unhandled error in onJobCompleted for job ${bullJob.data?.jobId}`);
            }
        });

        this.bullWorker.on('failed', async (bullJob: BullJob | undefined, error: Error) => {
            try {
                await listeners.onFailed(bullJob, error);
            } catch (handlerError) {
                logger.error(handlerError, `[${this.config.queueName}] Unhandled error in onJobFailed for job ${bullJob?.data?.jobId}`);
            }
        });

        this.bullWorker.on('error', (error: Error) => {
            logger.error(`[${this.config.queueName}] Worker error: ${error.message}`);
        });
    }
}
