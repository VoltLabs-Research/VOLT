import type { QueueJob, QueueJobState } from '@shared/infrastructure/queues/queue-job-model';
import type { JsonObject } from '@shared/contracts/types/json';

export const TERMINAL_JOB_RETENTION_MS = 86_400_000;

export interface EnqueueRequest {
    queue: string;
    jobKey: string;
    payload: JsonObject;
    maxAttempts: number;
    backoffType: string | null;
    backoffDelayMs: number | null;
}

export interface ReclaimedJobs {
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

export interface LiveQueueJobRef {
    jobKey: string;
    state: Extract<QueueJobState, 'waiting' | 'delayed' | 'active'>;
}

export const emptyQueueJobCounts = (): QueueJobCounts => ({
    waiting: 0,
    active: 0,
    delayed: 0,
    completed: 0,
    failed: 0
});

export interface QueueJobStore {
    insertJob(request: EnqueueRequest): Promise<boolean>;
    insertJobs(queue: string, requests: EnqueueRequest[]): Promise<number>;
    deleteTerminalJob(queue: string, jobKey: string): Promise<void>;
    isJobLive(queue: string, jobKey: string): Promise<boolean>;
    claimNextJob(queue: string, workerId: string, leaseDurationMs: number): Promise<QueueJob | null>;
    renewLease(jobId: string, workerId: string, leaseDurationMs: number): Promise<boolean>;
    completeJob(jobId: string): Promise<void>;
    failJob(jobId: string, reason: string): Promise<QueueJobState>;
    deferJob(jobId: string, runAt: Date): Promise<void>;
    reclaimStalledJobs(): Promise<ReclaimedJobs>;
    purgeExpiredTerminalJobs(): Promise<number>;
    retryFailedJobByKey(jobKey: string): Promise<boolean>;
    removeJobByKey(jobKey: string): Promise<boolean>;
    listLiveJobsByKeyPrefix(queue: string, jobKeyPrefix: string): Promise<LiveQueueJobRef[]>;
    countJobsByState(queue: string): Promise<QueueJobCounts>;
}
