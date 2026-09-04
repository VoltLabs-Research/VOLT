import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { TERMINAL_JOB_RETENTION_MS, emptyQueueJobCounts } from '@shared/infrastructure/queues/queue-job-store-contract';
import type {
    EnqueueRequest,
    LiveQueueJobRef,
    QueueJobCounts,
    QueueJobStore,
    ReclaimedJobs
} from '@shared/infrastructure/queues/queue-job-store-contract';
import type { QueueJob, QueueJobState } from '@shared/infrastructure/queues/queue-job-model';

const manager = () => getDaemonDataSource().manager;

export class PostgresQueueJobStore implements QueueJobStore {
    async insertJob(request: EnqueueRequest): Promise<boolean> {
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
    }

    async insertJobs(queue: string, requests: EnqueueRequest[]): Promise<number> {
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
    }

    async deleteTerminalJob(queue: string, jobKey: string): Promise<void> {
        await manager().query(
            `DELETE FROM queue_jobs
             WHERE queue = $1 AND "jobKey" = $2 AND state IN ('completed', 'failed')`,
            [queue, jobKey]
        );
    }

    async isJobLive(queue: string, jobKey: string): Promise<boolean> {
        const rows = await manager().query<{ id: string }[]>(
            `SELECT id FROM queue_jobs
             WHERE queue = $1 AND "jobKey" = $2 AND state IN ('waiting', 'delayed', 'active')`,
            [queue, jobKey]
        );

        return rows.length > 0;
    }

    async claimNextJob(queue: string, workerId: string, leaseDurationMs: number): Promise<QueueJob | null> {
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
    }

    async renewLease(jobId: string, workerId: string, leaseDurationMs: number): Promise<boolean> {
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
    }

    async completeJob(jobId: string): Promise<void> {
        await manager().query(
            `UPDATE queue_jobs
             SET state = 'completed', "lockedUntil" = NULL, "lockedBy" = NULL, "updatedAt" = now()
             WHERE id = $1`,
            [jobId]
        );
    }

    async failJob(jobId: string, reason: string): Promise<QueueJobState> {
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
    }

    async deferJob(jobId: string, runAt: Date): Promise<void> {
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
    }

    async reclaimStalledJobs(): Promise<ReclaimedJobs> {
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
    }

    async purgeExpiredTerminalJobs(): Promise<number> {
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
    }

    async retryFailedJobByKey(jobKey: string): Promise<boolean> {
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
    }

    async removeJobByKey(jobKey: string): Promise<boolean> {
        const rows = await manager().query<{ id: string }[]>(
            'WITH removed AS (DELETE FROM queue_jobs WHERE "jobKey" = $1 RETURNING id) SELECT id FROM removed',
            [jobKey]
        );

        return rows.length > 0;
    }

    listLiveJobsByKeyPrefix(queue: string, jobKeyPrefix: string): Promise<LiveQueueJobRef[]> {
        return manager().query<LiveQueueJobRef[]>(
            `SELECT "jobKey", state FROM queue_jobs
             WHERE queue = $1
               AND starts_with("jobKey", $2)
               AND state IN ('waiting', 'delayed', 'active')`,
            [queue, jobKeyPrefix]
        );
    }

    async countJobsByState(queue: string): Promise<QueueJobCounts> {
        const rows = await manager().query<{ state: QueueJobState; total: string }[]>(
            'SELECT state, count(*)::text AS total FROM queue_jobs WHERE queue = $1 GROUP BY state',
            [queue]
        );

        const counts = emptyQueueJobCounts();
        for (const row of rows) {
            counts[row.state] = Number(row.total);
        }

        return counts;
    }
}
