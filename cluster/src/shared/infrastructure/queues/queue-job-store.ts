import { singleton } from '@shared/application/utilities/singleton';
import { getDatabaseDialect } from '@shared/infrastructure/persistence/dialect';
import { PostgresQueueJobStore } from '@shared/infrastructure/queues/PostgresQueueJobStore';
import { SqliteQueueJobStore } from '@shared/infrastructure/queues/SqliteQueueJobStore';
import { getQueueNotifier } from '@shared/infrastructure/queues/QueueNotifier';
import type {
    EnqueueRequest,
    LiveQueueJobRef,
    QueueJobCounts,
    QueueJobStore,
    ReclaimedJobs
} from '@shared/infrastructure/queues/queue-job-store-contract';
import type { QueueJob, QueueJobState } from '@shared/infrastructure/queues/queue-job-model';

export type { EnqueueRequest, LiveQueueJobRef, QueueJobCounts, QueueJobStore } from '@shared/infrastructure/queues/queue-job-store-contract';

export const getQueueJobStore = singleton((): QueueJobStore =>
    getDatabaseDialect() === 'sqlite' ? new SqliteQueueJobStore() : new PostgresQueueJobStore());

export const insertJob = (request: EnqueueRequest): Promise<boolean> => getQueueJobStore().insertJob(request);

export const insertJobs = (queue: string, requests: EnqueueRequest[]): Promise<number> => getQueueJobStore().insertJobs(queue, requests);

export const deleteTerminalJob = (queue: string, jobKey: string): Promise<void> => getQueueJobStore().deleteTerminalJob(queue, jobKey);

export const isJobLive = (queue: string, jobKey: string): Promise<boolean> => getQueueJobStore().isJobLive(queue, jobKey);

export const notifyQueue = (queue: string): Promise<void> => getQueueNotifier().notify(queue);

export const claimNextJob = (queue: string, workerId: string, leaseDurationMs: number): Promise<QueueJob | null> =>
    getQueueJobStore().claimNextJob(queue, workerId, leaseDurationMs);

export const renewLease = (jobId: string, workerId: string, leaseDurationMs: number): Promise<boolean> =>
    getQueueJobStore().renewLease(jobId, workerId, leaseDurationMs);

export const completeJob = (jobId: string): Promise<void> => getQueueJobStore().completeJob(jobId);

export const failJob = (jobId: string, reason: string): Promise<QueueJobState> => getQueueJobStore().failJob(jobId, reason);

export const deferJob = (jobId: string, runAt: Date): Promise<void> => getQueueJobStore().deferJob(jobId, runAt);

export const reclaimStalledJobs = (): Promise<ReclaimedJobs> => getQueueJobStore().reclaimStalledJobs();

export const purgeExpiredTerminalJobs = (): Promise<number> => getQueueJobStore().purgeExpiredTerminalJobs();

export const retryFailedJobByKey = (jobKey: string): Promise<boolean> => getQueueJobStore().retryFailedJobByKey(jobKey);

export const removeJobByKey = (jobKey: string): Promise<boolean> => getQueueJobStore().removeJobByKey(jobKey);

export const listLiveJobsByKeyPrefix = (queue: string, jobKeyPrefix: string): Promise<LiveQueueJobRef[]> =>
    getQueueJobStore().listLiveJobsByKeyPrefix(queue, jobKeyPrefix);

export const countJobsByState = (queue: string): Promise<QueueJobCounts> => getQueueJobStore().countJobsByState(queue);
