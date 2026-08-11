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

/**
 * How long a worker may hold a job before the queue assumes it died.
 *
 * Compute jobs here drive native binaries that run for minutes on large frames.
 * The lease is renewed on a timer while a job runs, so a busy event loop can miss
 * a renewal and let the lease lapse — the job is then handed to another slot and
 * the same frame is analysed twice in parallel. That was observed on a 4.45M-atom
 * frame: two OpenDXA processes on the identical timestep, each holding several GB.
 *
 * The window is therefore set well beyond any realistic job, and a job is failed
 * rather than redelivered after a second stall so a job that kills its worker
 * cannot loop.
 */
const WORKER_LEASE_DURATION_MS = readPositiveIntegerEnv('QUEUE_WORKER_LOCK_DURATION_MS') ?? 3_600_000;

/**
 * Fallback poll interval. Enqueues notify idle workers, so this only bounds how
 * late a delayed job's own deadline can be noticed, and how long a queue stays
 * quiet if the notification listener is down.
 */
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
    /*
     * A job without a caller-supplied id gets a generated one so every row has a
     * key. Only supplied ids are addressable afterwards, which is the same
     * property the previous queue had.
     */
    jobKey: payload.jobId ?? randomUUID(),
    payload: payload as unknown as JsonObject,
    maxAttempts: Math.max(1, options.attempts ?? 1),
    backoffType: options.backoff?.type ?? null,
    backoffDelayMs: options.backoff?.delay ?? null
});

/**
 * The daemon's job queues, on Postgres.
 *
 * Jobs are claimed with `FOR UPDATE SKIP LOCKED`, which is what lets several
 * workers draw from one queue without coordinating, and idle workers are woken by
 * `NOTIFY` rather than only polling. Duplicate suppression is a partial unique
 * index over the non-terminal states, so "is this already queued?" and the insert
 * are a single statement instead of a check followed by a write.
 */
export class QueueService {
    private readonly workers = new Set<QueueWorker<never>>();

    async close(): Promise<void> {
        await Promise.all([...this.workers].map((worker) => worker.close()));
        this.workers.clear();
        await getQueueNotifier().close();
    }

    /**
     * Resolves false when the job was not added because an equivalent one is still
     * live in that queue. Callers that pass `preserveExistingJob` read this; the
     * rest enqueue and ignore it.
     */
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

        /*
         * A settled row still holds the key, and the unique index deliberately
         * does not cover terminal states, so the old row is cleared to let the key
         * be re-enqueued rather than accumulating a row per run.
         */
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

    /** Only a failed job is retryable, so a running or queued one is left alone. */
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
