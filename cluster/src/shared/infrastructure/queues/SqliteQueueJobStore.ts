import { randomUUID } from 'node:crypto';
import { getDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { chunked } from '@shared/infrastructure/persistence/sqlite-sql';
import { fromSqliteDateTime, sqliteDateTimeFromNow, sqliteNow, toSqliteDateTime } from '@shared/infrastructure/persistence/sqlite-time';
import { TERMINAL_JOB_RETENTION_MS, emptyQueueJobCounts } from '@shared/infrastructure/queues/queue-job-store-contract';
import type {
    EnqueueRequest,
    LiveQueueJobRef,
    QueueJobCounts,
    QueueJobStore,
    ReclaimedJobs
} from '@shared/infrastructure/queues/queue-job-store-contract';
import type { QueueJob, QueueJobState } from '@shared/infrastructure/queues/queue-job-model';
import type { EntityManager } from 'typeorm';

const LIVE_STATES = `('waiting', 'delayed', 'active')`;
const INSERT_COLUMNS = '(id, queue, "jobKey", payload, state, "maxAttempts", "backoffType", "backoffDelayMs", "runAt", "createdAt", "updatedAt")';
const INSERT_ROW_PLACEHOLDER = `(?, ?, ?, ?, 'waiting', ?, ?, ?, ?, ?, ?)`;

interface SqliteQueueJobRow extends Omit<QueueJob, 'payload' | 'runAt' | 'lockedUntil' | 'createdAt' | 'updatedAt'> {
    payload: string;
    runAt: string;
    lockedUntil: string | null;
    createdAt: string;
    updatedAt: string;
}

interface FailureContext {
    attemptsMade: number;
    maxAttempts: number;
    backoffType: string | null;
    backoffDelayMs: number | null;
}

const manager = () => getDaemonDataSource().manager;

const toQueueJob = (row: SqliteQueueJobRow): QueueJob => ({
    ...row,
    payload: JSON.parse(row.payload),
    runAt: fromSqliteDateTime(row.runAt) as Date,
    lockedUntil: fromSqliteDateTime(row.lockedUntil),
    createdAt: fromSqliteDateTime(row.createdAt) as Date,
    updatedAt: fromSqliteDateTime(row.updatedAt) as Date
});

const insertParameters = (request: EnqueueRequest, now: string): unknown[] => [
    randomUUID(),
    request.queue,
    request.jobKey,
    JSON.stringify(request.payload),
    request.maxAttempts,
    request.backoffType,
    request.backoffDelayMs,
    now,
    now,
    now
];

const retryDelayMs = (context: FailureContext): number => {
    const baseDelay = context.backoffDelayMs ?? 0;
    return context.backoffType === 'exponential'
        ? baseDelay * 2 ** (context.attemptsMade - 1)
        : baseDelay;
};

export class SqliteQueueJobStore implements QueueJobStore {
    async insertJob(request: EnqueueRequest): Promise<boolean> {
        const rows = await manager().query<{ id: string }[]>(
            `INSERT INTO queue_jobs ${INSERT_COLUMNS}
             VALUES ${INSERT_ROW_PLACEHOLDER}
             ON CONFLICT DO NOTHING
             RETURNING id`,
            insertParameters(request, sqliteNow())
        );

        return rows.length > 0;
    }

    async insertJobs(queue: string, requests: EnqueueRequest[]): Promise<number> {
        if (requests.length === 0) {
            return 0;
        }

        return manager().transaction(async (transactional: EntityManager) => {
            const now = sqliteNow();
            let inserted = 0;

            const options = requests[0];
            for (const chunk of chunked(requests)) {
                const rows = await transactional.query<{ id: string }[]>(
                    `INSERT INTO queue_jobs ${INSERT_COLUMNS}
                     VALUES ${chunk.map(() => INSERT_ROW_PLACEHOLDER).join(', ')}
                     ON CONFLICT DO NOTHING
                     RETURNING id`,
                    chunk.flatMap((request) => insertParameters({
                        queue,
                        jobKey: request.jobKey,
                        payload: request.payload,
                        maxAttempts: options.maxAttempts,
                        backoffType: options.backoffType,
                        backoffDelayMs: options.backoffDelayMs
                    }, now))
                );
                inserted += rows.length;
            }

            return inserted;
        });
    }

    async deleteTerminalJob(queue: string, jobKey: string): Promise<void> {
        await manager().query(
            `DELETE FROM queue_jobs
             WHERE queue = ? AND "jobKey" = ? AND state IN ('completed', 'failed')`,
            [queue, jobKey]
        );
    }

    async isJobLive(queue: string, jobKey: string): Promise<boolean> {
        const rows = await manager().query<{ id: string }[]>(
            `SELECT id FROM queue_jobs
             WHERE queue = ? AND "jobKey" = ? AND state IN ${LIVE_STATES}`,
            [queue, jobKey]
        );

        return rows.length > 0;
    }

    async claimNextJob(queue: string, workerId: string, leaseDurationMs: number): Promise<QueueJob | null> {
        const now = sqliteNow();
        const rows = await manager().query<SqliteQueueJobRow[]>(
            `UPDATE queue_jobs
             SET state = 'active',
                 "attemptsMade" = "attemptsMade" + 1,
                 "lockedUntil" = ?,
                 "lockedBy" = ?,
                 "updatedAt" = ?
             WHERE id = (
                 SELECT id FROM queue_jobs
                 WHERE queue = ?
                   AND state IN ('waiting', 'delayed')
                   AND "runAt" <= ?
                 ORDER BY "runAt", "createdAt"
                 LIMIT 1
             )
             RETURNING *`,
            [sqliteDateTimeFromNow(leaseDurationMs), workerId, now, queue, now]
        );

        return rows[0] ? toQueueJob(rows[0]) : null;
    }

    async renewLease(jobId: string, workerId: string, leaseDurationMs: number): Promise<boolean> {
        const rows = await manager().query<{ id: string }[]>(
            `UPDATE queue_jobs
             SET "lockedUntil" = ?, "updatedAt" = ?
             WHERE id = ? AND "lockedBy" = ? AND state = 'active'
             RETURNING id`,
            [sqliteDateTimeFromNow(leaseDurationMs), sqliteNow(), jobId, workerId]
        );

        return rows.length > 0;
    }

    async completeJob(jobId: string): Promise<void> {
        await manager().query(
            `UPDATE queue_jobs
             SET state = 'completed', "lockedUntil" = NULL, "lockedBy" = NULL, "updatedAt" = ?
             WHERE id = ?`,
            [sqliteNow(), jobId]
        );
    }

    async failJob(jobId: string, reason: string): Promise<QueueJobState> {
        return manager().transaction(async (transactional: EntityManager) => {
            const contexts = await transactional.query<FailureContext[]>(
                `SELECT "attemptsMade", "maxAttempts", "backoffType", "backoffDelayMs"
                 FROM queue_jobs WHERE id = ?`,
                [jobId]
            );
            const context = contexts[0];
            if (!context) {
                return 'failed';
            }

            const state: QueueJobState = context.attemptsMade < context.maxAttempts ? 'delayed' : 'failed';
            const now = sqliteNow();
            const runAtAssignment = state === 'delayed' ? '"runAt" = ?,' : '';
            const parameters = state === 'delayed'
                ? [state, sqliteDateTimeFromNow(retryDelayMs(context)), reason, now, jobId]
                : [state, reason, now, jobId];

            await transactional.query(
                `UPDATE queue_jobs
                 SET state = ?,
                     ${runAtAssignment}
                     "failedReason" = ?,
                     "lockedUntil" = NULL,
                     "lockedBy" = NULL,
                     "updatedAt" = ?
                 WHERE id = ?`,
                parameters
            );

            return state;
        });
    }

    async deferJob(jobId: string, runAt: Date): Promise<void> {
        await manager().query(
            `UPDATE queue_jobs
             SET state = 'delayed',
                 "runAt" = ?,
                 "attemptsMade" = MAX(0, "attemptsMade" - 1),
                 "lockedUntil" = NULL,
                 "lockedBy" = NULL,
                 "updatedAt" = ?
             WHERE id = ?`,
            [toSqliteDateTime(runAt), sqliteNow(), jobId]
        );
    }

    async reclaimStalledJobs(): Promise<ReclaimedJobs> {
        const now = sqliteNow();
        const rows = await manager().query<{ state: QueueJobState }[]>(
            `UPDATE queue_jobs
             SET state = CASE WHEN "stalledCount" >= 1 THEN 'failed' ELSE 'waiting' END,
                 "stalledCount" = "stalledCount" + 1,
                 "failedReason" = CASE
                     WHEN "stalledCount" >= 1 THEN 'Job stalled repeatedly and was not retried'
                     ELSE "failedReason"
                 END,
                 "lockedUntil" = NULL,
                 "lockedBy" = NULL,
                 "updatedAt" = ?
             WHERE state = 'active' AND "lockedUntil" IS NOT NULL AND "lockedUntil" <= ?
             RETURNING state`,
            [now, now]
        );

        return {
            requeued: rows.filter((row) => row.state === 'waiting').length,
            failed: rows.filter((row) => row.state === 'failed').length
        };
    }

    async purgeExpiredTerminalJobs(): Promise<number> {
        const rows = await manager().query<{ id: string }[]>(
            `DELETE FROM queue_jobs
             WHERE state IN ('completed', 'failed') AND "updatedAt" <= ?
             RETURNING id`,
            [sqliteDateTimeFromNow(-TERMINAL_JOB_RETENTION_MS)]
        );

        return rows.length;
    }

    async retryFailedJobByKey(jobKey: string): Promise<boolean> {
        const now = sqliteNow();
        const rows = await manager().query<{ id: string }[]>(
            `UPDATE queue_jobs
             SET state = 'waiting',
                 "attemptsMade" = 0,
                 "stalledCount" = 0,
                 "failedReason" = NULL,
                 "runAt" = ?,
                 "updatedAt" = ?
             WHERE "jobKey" = ? AND state = 'failed'
             RETURNING id`,
            [now, now, jobKey]
        );

        return rows.length > 0;
    }

    async removeJobByKey(jobKey: string): Promise<boolean> {
        const rows = await manager().query<{ id: string }[]>(
            'DELETE FROM queue_jobs WHERE "jobKey" = ? RETURNING id',
            [jobKey]
        );

        return rows.length > 0;
    }

    listLiveJobsByKeyPrefix(queue: string, jobKeyPrefix: string): Promise<LiveQueueJobRef[]> {
        return manager().query<LiveQueueJobRef[]>(
            `SELECT "jobKey", state FROM queue_jobs
             WHERE queue = ?
               AND substr("jobKey", 1, ?) = ?
               AND state IN ${LIVE_STATES}`,
            [queue, jobKeyPrefix.length, jobKeyPrefix]
        );
    }

    async countJobsByState(queue: string): Promise<QueueJobCounts> {
        const rows = await manager().query<{ state: QueueJobState; total: number }[]>(
            'SELECT state, count(*) AS total FROM queue_jobs WHERE queue = ? GROUP BY state',
            [queue]
        );

        const counts = emptyQueueJobCounts();
        for (const row of rows) {
            counts[row.state] = Number(row.total);
        }

        return counts;
    }
}
