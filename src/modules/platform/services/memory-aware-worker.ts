import { logger } from '@/core/logger';
import { isMemoryPressured } from '@/core/memory';
import { DelayedError, type Job, type Worker } from 'bullmq';

import type { QueueService } from './QueueService';

export interface MemoryAwareWorkerStartOptions<T extends Record<string, unknown>> {
    concurrency?: number;
    onFailed?: (job: Job<T> | undefined, error: unknown) => Promise<void> | void;
};

export interface MemoryAwareWorkerShell<T extends Record<string, unknown>> {
    start: (
        processJob: (jobPayload: T, job: Job<T>) => Promise<void>,
        options?: MemoryAwareWorkerStartOptions<T>
    ) => Worker<T>;
    setConcurrency: (concurrency: number) => void;
    stop: () => Promise<void>;
};

interface MemoryAwareWorkerShellConfig {
    queueService: QueueService;
    queueName: string;
    startedMessage: string;
    stoppedMessage: string;
    failedMessage: string;
};

interface MemoryPressureDelayOptions {
    jobId: string;
    delayMs?: number;
    message: string;
    logContext?: Record<string, unknown>;
};

export const createMemoryAwareWorkerShell = <T extends Record<string, unknown>>(
    config: MemoryAwareWorkerShellConfig
): MemoryAwareWorkerShell<T> => {
    let worker: Worker<T> | null = null;

    return {
        start(processJob, options = {}) {
            if (worker) {
                return worker;
            }

            worker = config.queueService.createWorker<T>(
                config.queueName,
                async (jobPayload, job) => processJob(jobPayload, job),
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
                        jobId: job?.data?.jobId,
                        err: error
                    },
                    config.failedMessage
                );
            });

            logger.info(config.startedMessage);
            return worker;
        },

        setConcurrency(concurrency) {
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

export const delayJobWhenMemoryPressured = async <T extends Record<string, unknown>>(
    bullJob: Job<T>,
    options: MemoryPressureDelayOptions
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
