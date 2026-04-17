import { logger } from '@/core/logger';
import { isMemoryPressured } from '@/core/memory';
import { DelayedError } from 'bullmq';

interface MemoryAwareWorkerPayload {
    jobId?: string;
}

interface MemoryAwareWorkerJob<T extends MemoryAwareWorkerPayload> {
    data: T;
    token?: string;
    moveToDelayed(timestamp: number, token?: string): Promise<void>;
}

interface MemoryAwareWorker<T extends MemoryAwareWorkerPayload> {
    concurrency: number;
    close(): Promise<void>;
    on(
        event: 'failed',
        listener: (job: MemoryAwareWorkerJob<T> | undefined, error: Error) => Promise<void> | void
    ): void;
}

interface MemoryAwareWorkerQueueService {
    createWorker<T extends MemoryAwareWorkerPayload>(
        queueName: string,
        processJob: (jobPayload: T, job: MemoryAwareWorkerJob<T>) => Promise<void>,
        options: MemoryAwareWorkerCreateWorkerOptions
    ): MemoryAwareWorker<T>;
}

interface MemoryAwareWorkerCreateWorkerOptions {
    concurrency: number;
}

interface MemoryAwareWorkerConfig {
    queueService: MemoryAwareWorkerQueueService;
    queueName: string;
    startedMessage: string;
    stoppedMessage: string;
    failedMessage: string;
}

interface MemoryAwareWorkerDelayOptions {
    jobId: string;
    delayMs?: number;
    message: string;
    logContext?: Record<string, boolean | null | number | string>;
}

interface MemoryAwareWorkerShellOptions<T extends MemoryAwareWorkerPayload> {
    concurrency?: number;
    onFailed?: (job: MemoryAwareWorkerJob<T> | undefined, error: Error) => Promise<void> | void;
}

export interface MemoryAwareWorkerShell<T extends MemoryAwareWorkerPayload> {
    start: (
        processJob: (jobPayload: T, job: MemoryAwareWorkerJob<T>) => Promise<void>,
        options?: MemoryAwareWorkerShellOptions<T>
    ) => MemoryAwareWorker<T>;
    setConcurrency: (concurrency: number) => void;
    stop: () => Promise<void>;
}

export const createMemoryAwareWorkerShell = <T extends MemoryAwareWorkerPayload>(
    config: MemoryAwareWorkerConfig
): MemoryAwareWorkerShell<T> => {
    let worker: MemoryAwareWorker<T> | null = null;

    return {
        start(processJob, options = {}) {
            if (worker) {
                return worker;
            }

            worker = config.queueService.createWorker<T>(
                config.queueName,
                (jobPayload, job) => processJob(jobPayload, job),
                {
                    concurrency: options.concurrency ?? 2
                }
            );

            worker.on('failed', async (job, error) => {
                if (options.onFailed) {
                    await options.onFailed(job, error);
                }

                logger.error(
                    {
                        jobId: job ? job.data.jobId : undefined,
                        err: error
                    },
                    config.failedMessage
                );
            });

            logger.info(config.startedMessage);
            return worker;
        },

        setConcurrency: (concurrency) => {
            if (!worker) {
                throw new Error(`Worker for queue ${config.queueName} has not started`);
            }

            worker.concurrency = concurrency;
        },

        async stop() {
            if (!worker) {
                return;
            }

            await worker.close();
            worker = null;
            logger.info(config.stoppedMessage);
        }
    };
};

export const delayJobWhenMemoryPressured = async <T extends MemoryAwareWorkerPayload>(
    bullJob: MemoryAwareWorkerJob<T>,
    options: MemoryAwareWorkerDelayOptions
): Promise<void> => {
    if (!isMemoryPressured()) {
        return;
    }

    const delayMs = options.delayMs ?? 30_000;
    logger.warn(
        {
            ...options.logContext,
            jobId: options.jobId,
            delayMs
        },
        options.message
    );

    await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
    throw new DelayedError();
};
