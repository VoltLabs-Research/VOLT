import { randomUUID } from 'node:crypto';
import { singleton } from '@shared/application/utilities/singleton';
import { ANALYSIS_QUEUE_NAME, ARTIFACT_UPLOAD_QUEUE_NAME, PIPELINE_QUEUE_NAME, PLUGIN_WARMUP_QUEUE_NAME, TRAJECTORY_FRAME_PROCESSING_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME, TRAJECTORY_RASTER_QUEUE_NAME } from '@core/constants/queue-names';
import { QueueWorker } from '@shared/infrastructure/queues/QueueWorker';
import { getQueueNotifier } from '@shared/infrastructure/queues/QueueNotifier';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import {
    countJobsByState,
    deleteTerminalJob,
    insertJob,
    insertJobs,
    isJobLive,
    notifyQueue,
    removeJobByKey,
    retryFailedJobByKey
} from '@shared/infrastructure/queues/queue-job-store';
import type { EnqueueRequest, QueueJobCounts } from '@shared/infrastructure/queues/queue-job-store';
import type { QueueJobHandle } from '@shared/infrastructure/queues/queue-job-handle';
import type { JsonObject } from '@shared/contracts/types/json';

interface CreateWorkerOptions {
    concurrency?: number;
}

export interface QueuePayload {
    jobId?: string;
}

interface EnqueueBackoff {
    type: string;
    delay: number;
}

interface EnqueueOptions {
    preserveExistingJob?: boolean;
    attempts?: number;
    backoff?: EnqueueBackoff;
}

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

const WORKER_LEASE_DURATION_MS = readPositiveIntegerEnv('QUEUE_WORKER_LOCK_DURATION_MS') ?? 3_600_000;

const WORKER_POLL_INTERVAL_MS = readPositiveIntegerEnv('QUEUE_WORKER_POLL_INTERVAL_MS') ?? 2_000;

const assertKnownQueue = (queueName: string): void => {
    if (!KNOWN_QUEUE_NAME_SET.has(queueName)) {
        throw new Error(`Unsupported queue: ${queueName}`);
    }
};

const toEnqueueRequest = (
    queueName: string,
    payload: QueuePayload,
    options: EnqueueOptions
): EnqueueRequest => ({
    queue: queueName,
    jobKey: payload.jobId ?? randomUUID(),
    payload: payload as unknown as JsonObject,
    maxAttempts: Math.max(1, options.attempts ?? 1),
    backoffType: options.backoff?.type ?? null,
    backoffDelayMs: options.backoff?.delay ?? null
});

export class QueueService {
    private readonly workers = new Set<QueueWorker<never>>();

    async close(): Promise<void> {
        await Promise.all([...this.workers].map((worker) => worker.close()));
        this.workers.clear();
        await getQueueNotifier().close();
    }

    async enqueue<T extends QueuePayload>(
        queueName: string,
        payload: T,
        options: EnqueueOptions = {}
    ): Promise<boolean> {
        assertKnownQueue(queueName);

        const request = toEnqueueRequest(queueName, payload, options);

        if (options.preserveExistingJob && await isJobLive(queueName, request.jobKey)) {
            return false;
        }

        await deleteTerminalJob(queueName, request.jobKey);

        const inserted = await insertJob(request);
        if (inserted) {
            await notifyQueue(queueName);
        }

        return inserted;
    }

    async enqueueBulk<T extends QueuePayload>(
        queueName: string,
        payloads: T[],
        options: EnqueueOptions = {}
    ): Promise<void> {
        if (payloads.length === 0) return;

        assertKnownQueue(queueName);

        const requests = payloads.map((payload) => toEnqueueRequest(queueName, payload, options));
        const inserted = await insertJobs(queueName, requests);

        if (inserted > 0) {
            await notifyQueue(queueName);
        }
    }

    createWorker = <T extends QueuePayload>(
        queueName: string,
        processor: (payload: T, job: QueueJobHandle<T>) => Promise<void>,
        options: CreateWorkerOptions = {}
    ): QueueWorker<T> => {
        assertKnownQueue(queueName);

        const worker = new QueueWorker<T>(queueName, processor, {
            concurrency: options.concurrency ?? 1,
            leaseDurationMs: WORKER_LEASE_DURATION_MS,
            pollIntervalMs: WORKER_POLL_INTERVAL_MS
        });

        this.workers.add(worker as unknown as QueueWorker<never>);
        return worker;
    };

    retryJobById(jobId: string): Promise<boolean> {
        return retryFailedJobByKey(jobId);
    }

    removeJobById(jobId: string): Promise<boolean> {
        return removeJobByKey(jobId);
    }

    getJobCounts(queueName: string): Promise<QueueJobCounts> {
        assertKnownQueue(queueName);
        return countJobsByState(queueName);
    }

    listKnownQueueNames(): readonly string[] {
        return KNOWN_QUEUE_NAMES;
    }
}

export const getQueueService = singleton((): QueueService => new QueueService());
