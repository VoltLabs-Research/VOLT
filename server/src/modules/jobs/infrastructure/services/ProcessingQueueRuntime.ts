import {
    MAX_RETRIES,
    RETRY_BACKOFF_MS,
    STATUS_TTL_SECONDS,
    STALLED_INTERVAL_MS
} from '@modules/jobs/infrastructure/services/ProcessingQueueShared';
import logger from '@shared/infrastructure/logger';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { ConnectionOptions, Job as BullJob, JobProgress, Processor } from 'bullmq';
import type { QueueJobData } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';

interface QueueBulkJobOptions {
    jobId: string;
};

interface ProcessingQueueRuntimeConfig {
    queueName: string;
    workerPath: string;
    maxConcurrentJobs: number;
    connection: ConnectionOptions;
    withWorker?: boolean;
    workerExecArgv?: string[];
    inlineProcessor?: Processor;
};

interface ProcessingQueueRuntimeListeners {
    onActive: (bullJob: BullJob) => Promise<void>;
    onProgress: (bullJob: BullJob, progress: JobProgress) => Promise<void>;
    onCompleted: (bullJob: BullJob) => Promise<void>;
    onFailed: (bullJob: BullJob | undefined, error: Error) => Promise<void>;
};

export interface QueueBulkJob {
    name: string;
    data: QueueJobData;
    opts: QueueBulkJobOptions;
};

export default class ProcessingQueueRuntime {
    private readonly bullQueue: Queue;
    private readonly bullWorker: Worker | null;
    private readonly bullQueueEvents: QueueEvents | null;

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

        this.bullWorker = this.config.withWorker === false
            ? null
            : this.config.inlineProcessor
                ? new Worker(
                    this.config.queueName,
                    this.config.inlineProcessor,
                    {
                        connection: this.config.connection,
                        concurrency: this.config.maxConcurrentJobs,
                        stalledInterval: STALLED_INTERVAL_MS,
                        removeOnComplete: { count: 1000 },
                        removeOnFail: { count: 5000 }
                    }
                )
                : new Worker(
                    this.config.queueName,
                    this.config.workerPath,
                    {
                        connection: this.config.connection,
                        concurrency: this.config.maxConcurrentJobs,
                        stalledInterval: STALLED_INTERVAL_MS,
                        removeOnComplete: { count: 1000 },
                        removeOnFail: { count: 5000 },
                        workerForkOptions: this.config.workerExecArgv?.length
                            ? { execArgv: this.config.workerExecArgv }
                            : undefined
                    }
                );

        if (this.bullWorker) {
            this.attachWorkerListeners(this.bullWorker, listeners);
            this.bullQueueEvents = null;
            const mode = this.config.inlineProcessor ? 'inline' : `sandboxed (path=${this.config.workerPath})`;
            logger.info(`[${this.config.queueName}] Local BullMQ Worker created (concurrency=${this.config.maxConcurrentJobs}, mode=${mode})`);
        } else {
            this.bullQueueEvents = new QueueEvents(this.config.queueName, {
                connection: this.config.connection
            });
            this.attachQueueEventsListeners(this.bullQueueEvents, listeners);
            logger.info(`[${this.config.queueName}] QueueEvents listener created (no local worker)`);
        }
    }

    async addBulk(jobs: QueueBulkJob[]): Promise<void> {
        await this.bullQueue.addBulk(jobs);
    }

    async getJob(jobId: string): Promise<BullJob | undefined | null> {
        return this.bullQueue.getJob(jobId);
    }

    async close(): Promise<void> {
        if (this.bullWorker) {
            await this.bullWorker.close();
        }
        if (this.bullQueueEvents) {
            await this.bullQueueEvents.close();
        }
        await this.bullQueue.close();
    }

    private attachWorkerListeners(worker: Worker, listeners: ProcessingQueueRuntimeListeners): void {
        worker.on('active', async (bullJob: BullJob) => {
            logger.info(`[${this.config.queueName}] Worker event: active - job ${bullJob.data?.jobId || bullJob.id}`);
            try {
                await listeners.onActive(bullJob);
            } catch (error) {
                logger.error(error, `[${this.config.queueName}] Unhandled error in onJobActive for job ${bullJob.data?.jobId}`);
            }
        });

        worker.on('progress', async (bullJob: BullJob, progress: JobProgress) => {
            logger.info(`[${this.config.queueName}] Worker event: progress - job ${bullJob.data?.jobId || bullJob.id} progress=${JSON.stringify(progress)}`);
            try {
                await listeners.onProgress(bullJob, progress);
            } catch (error) {
                logger.error(error, `[${this.config.queueName}] Unhandled error in onJobProgress for job ${bullJob.data?.jobId}`);
            }
        });

        worker.on('completed', async (bullJob: BullJob) => {
            logger.info(`[${this.config.queueName}] Worker event: completed - job ${bullJob.data?.jobId || bullJob.id}`);
            try {
                await listeners.onCompleted(bullJob);
            } catch (error) {
                logger.error(error, `[${this.config.queueName}] Unhandled error in onJobCompleted for job ${bullJob.data?.jobId}`);
            }
        });

        worker.on('failed', async (bullJob: BullJob | undefined, error: Error) => {
            logger.error(`[${this.config.queueName}] Worker event: failed - job ${bullJob?.data?.jobId || bullJob?.id} error=${error.message}`);
            try {
                await listeners.onFailed(bullJob, error);
            } catch (handlerError) {
                logger.error(handlerError, `[${this.config.queueName}] Unhandled error in onJobFailed for job ${bullJob?.data?.jobId}`);
            }
        });

        worker.on('error', (error: Error) => {
            logger.error(`[${this.config.queueName}] Worker error: ${error.message}`);
        });

        worker.on('stalled', (jobId: string) => {
            logger.warn(`[${this.config.queueName}] Worker event: stalled - job ${jobId}`);
        });

        worker.on('ready', () => {
            logger.info(`[${this.config.queueName}] Worker is ready and listening for jobs`);
        });
    }

    private attachQueueEventsListeners(queueEvents: QueueEvents, listeners: ProcessingQueueRuntimeListeners): void {
        queueEvents.on('active', async ({ jobId }) => {
            try {
                const bullJob = await this.bullQueue.getJob(jobId);
                if (bullJob) {
                    await listeners.onActive(bullJob);
                }
            } catch (error) {
                logger.error(error, `[${this.config.queueName}] Unhandled error in QueueEvents onActive for job ${jobId}`);
            }
        });

        queueEvents.on('progress', async ({ jobId, data: progressData }) => {
            try {
                const bullJob = await this.bullQueue.getJob(jobId);
                if (bullJob) {
                    await listeners.onProgress(bullJob, progressData as JobProgress);
                }
            } catch (error) {
                logger.error(error, `[${this.config.queueName}] Unhandled error in QueueEvents onProgress for job ${jobId}`);
            }
        });

        queueEvents.on('completed', async ({ jobId }) => {
            try {
                const bullJob = await this.bullQueue.getJob(jobId);
                if (bullJob) {
                    await listeners.onCompleted(bullJob);
                } else {
                    logger.warn(`[${this.config.queueName}] QueueEvents completed: job ${jobId} not found in queue, creating synthetic callback`);
                    await listeners.onCompleted({ data: { jobId } } as BullJob);
                }
            } catch (error) {
                logger.error(error, `[${this.config.queueName}] Unhandled error in QueueEvents onCompleted for job ${jobId}`);
            }
        });

        queueEvents.on('failed', async ({ jobId, failedReason }) => {
            try {
                const bullJob = await this.bullQueue.getJob(jobId);
                const error = new Error(failedReason);
                if (bullJob) {
                    await listeners.onFailed(bullJob, error);
                } else {
                    logger.warn(`[${this.config.queueName}] QueueEvents failed: job ${jobId} not found in queue, creating synthetic callback`);
                    await listeners.onFailed({ data: { jobId } } as BullJob, error);
                }
            } catch (handlerError) {
                logger.error(handlerError, `[${this.config.queueName}] Unhandled error in QueueEvents onFailed for job ${jobId}`);
            }
        });

        queueEvents.on('error', (error: Error) => {
            logger.error(`[${this.config.queueName}] QueueEvents error: ${error.message}`);
        });
    }
};
