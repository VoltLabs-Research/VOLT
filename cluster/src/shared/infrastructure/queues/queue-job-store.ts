import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { QueueJob } from '@shared/infrastructure/queues/queue-job-model';
import type { QueueJobState } from '@shared/infrastructure/queues/queue-job-model';
import type { JsonObject } from '@shared/contracts/types/json';

/*
 * Mutations that report rows are wrapped in a CTE so the statement reads as a
 * SELECT.
 *
 * The driver returns a bare row array for SELECT and INSERT, but `[rows, count]`
 * for UPDATE and DELETE. Reading `rows[0]` off the second shape yields the row
 * array itself — truthy, and silently wrong. Wrapping makes every statement here
 * return the one shape.
 */

/** Woken workers poll immediately; the interval below is only the fallback. */
export const QUEUE_NOTIFY_CHANNEL = 'volt_queue_jobs';

/**
 * How long a terminal job is kept.
 *
 * Failed rows have to outlive their run because retrying one is a user action
 * taken minutes later, and `getJobCounts` reports both states to the runtime
 * view. Nothing reads them after that.
 */
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

/**
 * Inserts a job unless its key is already live in that queue.
 *
 * The conflict target is the partial unique index over non-terminal states, so
 * the "is it already queued?" check and the insert are one statement. Doing it as
 * a read followed by a write would let two callers both find nothing and both
 * enqueue the same work.
 */
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

/**
 * Inserts many jobs in one statement, skipping any whose key is already live.
 *
 * A trajectory can fan out to thousands of frame jobs, so this is one round trip
 * rather than one per job; the same partial unique index makes each row's
 * duplicate check atomic.
 */
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

/** Drops a job whose previous run already settled, so its key can be enqueued again. */
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

/**
 * Takes the next eligible job and leases it.
 *
 * `SKIP LOCKED` is what lets many workers pull from one queue without
 * coordinating: each skips rows another worker has already locked in its own
 * transaction rather than queueing behind them. The claim and the lease are the
 * same statement, so a job is never visible as claimed-but-unleased.
 */
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

/** Extends the lease of a job still being worked on. False once it has been reclaimed. */
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

/**
 * Records a failed attempt, scheduling a retry while attempts remain.
 *
 * The decision is made in SQL against the row's own counters rather than from the
 * copy the worker is holding, so a job reclaimed and retried elsewhere in the
 * meantime cannot have its attempt count rolled back by a late report.
 */
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

/**
 * Puts an active job back without spending an attempt.
 *
 * This is how a worker declines work it cannot run yet — a scope limit is already
 * held by another job on the same trajectory — as opposed to failing it. The
 * attempt is refunded so deferral does not eat the job's retry budget.
 */
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

/**
 * Reclaims jobs whose lease lapsed, and fails those that have now stalled twice.
 *
 * A lapsed lease means the worker died or stopped renewing; the job itself may be
 * innocent, so the first reclaim returns it to the queue. A second means the job
 * is what took the worker down, and handing it out again would loop.
 */
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

/** Only a failed job may be retried, matching the contract the callers relied on. */
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
