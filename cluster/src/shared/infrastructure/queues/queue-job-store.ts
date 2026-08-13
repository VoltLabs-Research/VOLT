import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { QueueJob } from '@shared/infrastructure/queues/queue-job-model';
import type { QueueJobState } from '@shared/infrastructure/queues/queue-job-model';
import type { JsonObject } from '@shared/contracts/types/json';


export const QUEUE_NOTIFY_CHANNEL = 'volt_queue_jobs';

const TERMINAL_JOB_RETENTION_MS = 86_400_000;

export interface EnqueueRequest {
    queue: string;
    jobKey: string;
    payload: JsonObject;
    maxAttempts: number;
    backoffType: string | null;
    backoffDelayMs: number | null;
}

interface ReclaimedJobs {
    requeued: number;
    failed: number;
}

export interface QueueJobCounts {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
}

const manager = () => getDaemonDataSource().manager;

export const insertJob = async (request: EnqueueRequest): Promise<boolean> => {
    const rows = await manager().query<{ id: string }[]>(
        `INSERT INTO queue_jobs
             (queue, "jobKey", payload, state, "maxAttempts", "backoffType", "backoffDelayMs", "runAt")
         VALUES ($1, $2, $3, 'waiting', $4, $5, $6, now())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
            request.queue,
            request.jobKey,
            JSON.stringify(request.payload),
            request.maxAttempts,
            request.backoffType,
            request.backoffDelayMs
        ]
    );

    return rows.length > 0;
};

export const insertJobs = async (queue: string, requests: EnqueueRequest[]): Promise<number> => {
    if (requests.length === 0) {
        return 0;
    }

    const rows = await manager().query<{ id: string }[]>(
        `INSERT INTO queue_jobs
             (queue, "jobKey", payload, state, "maxAttempts", "backoffType", "backoffDelayMs", "runAt")
         SELECT $1, source.job_key, source.payload::jsonb, 'waiting', $4, $5, $6, now()
         FROM unnest($2::text[], $3::text[]) AS source(job_key, payload)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
            queue,
            requests.map((request) => request.jobKey),
            requests.map((request) => JSON.stringify(request.payload)),
            requests[0].maxAttempts,
            requests[0].backoffType,
            requests[0].backoffDelayMs
        ]
    );

    return rows.length;
};

export const deleteTerminalJob = async (queue: string, jobKey: string): Promise<void> => {
    await manager().query(
        `DELETE FROM queue_jobs
         WHERE queue = $1 AND "jobKey" = $2 AND state IN ('completed', 'failed')`,
        [queue, jobKey]
    );
};

export const isJobLive = async (queue: string, jobKey: string): Promise<boolean> => {
    const rows = await manager().query<{ id: string }[]>(
        `SELECT id FROM queue_jobs
         WHERE queue = $1 AND "jobKey" = $2 AND state IN ('waiting', 'delayed', 'active')`,
        [queue, jobKey]
    );

    return rows.length > 0;
};

export const notifyQueue = async (queue: string): Promise<void> => {
    await manager().query('SELECT pg_notify($1, $2)', [QUEUE_NOTIFY_CHANNEL, queue]);
};

export const claimNextJob = async (
    queue: string,
    workerId: string,
    leaseDurationMs: number
): Promise<QueueJob | null> => {
    const rows = await manager().query<QueueJob[]>(
        `WITH candidate AS (
             SELECT id FROM queue_jobs
             WHERE queue = $1
               AND state IN ('waiting', 'delayed')
               AND "runAt" <= now()
             ORDER BY "runAt", "createdAt"
             FOR UPDATE SKIP LOCKED
             LIMIT 1
         ), claimed AS (
             UPDATE queue_jobs AS job
             SET state = 'active',
                 "attemptsMade" = job."attemptsMade" + 1,
                 "lockedUntil" = now() + make_interval(secs => $3::double precision / 1000),
                 "lockedBy" = $2,
                 "updatedAt" = now()
             FROM candidate
             WHERE job.id = candidate.id
             RETURNING job.*
         )
         SELECT * FROM claimed`,
        [queue, workerId, leaseDurationMs]
    );

    return rows[0] ?? null;
};

export const renewLease = async (
    jobId: string,
    workerId: string,
    leaseDurationMs: number
): Promise<boolean> => {
    const rows = await manager().query<{ id: string }[]>(
        `WITH renewed AS (
             UPDATE queue_jobs
             SET "lockedUntil" = now() + make_interval(secs => $3::double precision / 1000),
                 "updatedAt" = now()
             WHERE id = $1 AND "lockedBy" = $2 AND state = 'active'
             RETURNING id
         ) SELECT id FROM renewed`,
        [jobId, workerId, leaseDurationMs]
    );

    return rows.length > 0;
};

export const completeJob = async (jobId: string): Promise<void> => {
    await manager().query(
        `UPDATE queue_jobs
         SET state = 'completed', "lockedUntil" = NULL, "lockedBy" = NULL, "updatedAt" = now()
         WHERE id = $1`,
        [jobId]
    );
};

export const failJob = async (jobId: string, reason: string): Promise<QueueJobState> => {
    const rows = await manager().query<{ state: QueueJobState }[]>(
        `WITH settled AS (
         UPDATE queue_jobs
         SET state = CASE WHEN "attemptsMade" < "maxAttempts" THEN 'delayed' ELSE 'failed' END,
             "runAt" = CASE
                 WHEN "attemptsMade" < "maxAttempts" THEN now() + make_interval(
                     secs => (
                         CASE WHEN "backoffType" = 'exponential'
                             THEN COALESCE("backoffDelayMs", 0) * power(2, "attemptsMade" - 1)
                             ELSE COALESCE("backoffDelayMs", 0)
                         END
                     )::double precision / 1000
                 )
                 ELSE "runAt"
             END,
             "failedReason" = $2,
             "lockedUntil" = NULL,
             "lockedBy" = NULL,
             "updatedAt" = now()
         WHERE id = $1
         RETURNING state
         ) SELECT state FROM settled`,
        [jobId, reason]
    );

    return rows[0]?.state ?? 'failed';
};

export const deferJob = async (jobId: string, runAt: Date): Promise<void> => {
    await manager().query(
        `UPDATE queue_jobs
         SET state = 'delayed',
             "runAt" = $2,
             "attemptsMade" = GREATEST(0, "attemptsMade" - 1),
             "lockedUntil" = NULL,
             "lockedBy" = NULL,
             "updatedAt" = now()
         WHERE id = $1`,
        [jobId, runAt]
    );
};

export const reclaimStalledJobs = async (): Promise<ReclaimedJobs> => {
    const rows = await manager().query<{ state: QueueJobState }[]>(
        `WITH reclaimed AS (
         UPDATE queue_jobs
         SET state = CASE WHEN "stalledCount" >= 1 THEN 'failed' ELSE 'waiting' END,
             "stalledCount" = "stalledCount" + 1,
             "failedReason" = CASE
                 WHEN "stalledCount" >= 1 THEN 'Job stalled repeatedly and was not retried'
                 ELSE "failedReason"
             END,
             "lockedUntil" = NULL,
             "lockedBy" = NULL,
             "updatedAt" = now()
         WHERE state = 'active' AND "lockedUntil" IS NOT NULL AND "lockedUntil" <= now()
         RETURNING state
         ) SELECT state FROM reclaimed`
    );

    return {
        requeued: rows.filter((row) => row.state === 'waiting').length,
        failed: rows.filter((row) => row.state === 'failed').length
    };
};

export const purgeExpiredTerminalJobs = async (): Promise<number> => {
    const rows = await manager().query<{ id: string }[]>(
        `WITH purged AS (
             DELETE FROM queue_jobs
             WHERE state IN ('completed', 'failed')
               AND "updatedAt" <= now() - make_interval(secs => $1::double precision / 1000)
             RETURNING id
         ) SELECT id FROM purged`,
        [TERMINAL_JOB_RETENTION_MS]
    );

    return rows.length;
};

export const retryFailedJobByKey = async (jobKey: string): Promise<boolean> => {
    const rows = await manager().query<{ id: string }[]>(
        `WITH retried AS (
         UPDATE queue_jobs
         SET state = 'waiting',
             "attemptsMade" = 0,
             "stalledCount" = 0,
             "failedReason" = NULL,
             "runAt" = now(),
             "updatedAt" = now()
         WHERE "jobKey" = $1 AND state = 'failed'
         RETURNING id
         ) SELECT id FROM retried`,
        [jobKey]
    );

    return rows.length > 0;
};

export const removeJobByKey = async (jobKey: string): Promise<boolean> => {
    const rows = await manager().query<{ id: string }[]>(
        'WITH removed AS (DELETE FROM queue_jobs WHERE "jobKey" = $1 RETURNING id) SELECT id FROM removed',
        [jobKey]
    );

    return rows.length > 0;
};

export interface LiveQueueJobRef {
    jobKey: string;
    state: Extract<QueueJobState, 'waiting' | 'delayed' | 'active'>;
}

/**
 * Lists the jobs in `queue` whose key starts with `jobKeyPrefix` and that still have a
 * run ahead of them — waiting, delayed, or mid-flight.
 *
 * This is how a member of a fan-out group finds out what its siblings are still
 * doing, so the group needs no separate counter: the queue table already knows. A job
 * that failed permanently is no longer live, so a dead sibling cannot wedge the group.
 * The caller's own job is included, because the queue marks a job complete only after
 * its handler returns.
 */
export const listLiveJobsByKeyPrefix = async (
    queue: string,
    jobKeyPrefix: string
): Promise<LiveQueueJobRef[]> => (
    manager().query<LiveQueueJobRef[]>(
        `SELECT "jobKey", state FROM queue_jobs
         WHERE queue = $1
           AND starts_with("jobKey", $2)
           AND state IN ('waiting', 'delayed', 'active')`,
        [queue, jobKeyPrefix]
    )
);

export const countJobsByState = async (queue: string): Promise<QueueJobCounts> => {
    const rows = await manager().query<{ state: QueueJobState; total: string }[]>(
        'SELECT state, count(*)::text AS total FROM queue_jobs WHERE queue = $1 GROUP BY state',
        [queue]
    );

    const counts: QueueJobCounts = {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0
    };

    for (const row of rows) {
        counts[row.state] = Number(row.total);
    }

    return counts;
};
