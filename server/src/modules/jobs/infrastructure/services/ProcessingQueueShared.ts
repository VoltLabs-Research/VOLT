import Job from '@modules/jobs/domain/entities/Job';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import type { WorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';

export const SESSION_TTL_SECONDS = 86400;
export const STATUS_TTL_SECONDS = 86400;
export const MAX_RETRIES = 2;
export const RETRY_BACKOFF_MS = 5000;
export const STALLED_INTERVAL_MS = 30000;
export const JOB_STATUS_KEY_PREFIX = 'jobs:status:';

export interface SessionFailureSummaryRecord {
    failedJobs: number;
    lastFailure?: WorkerFailureEnvelope;
}

export interface ProcessingQueueSessionRecord {
    sessionId: string;
    startTime: Date | string;
    totalJobs: number;
    metadata: Record<string, unknown>;
    teamId: string;
    queueType: string;
    status: 'active';
}

export interface QueueStatusProjectionResult {
    statusData: Record<string, unknown>;
    teamId?: string;
}

export interface SessionDrainResult {
    completed: boolean;
    sessionData?: ProcessingQueueSessionRecord;
    failureSummary?: SessionFailureSummaryRecord;
    missingSessionData?: boolean;
}

export interface SessionCompletedSnapshot {
    sessionId: string;
    teamId: string;
    queueType: string;
    totalJobs: number;
    startTime: Date;
    completedAt: Date;
    metadata?: Record<string, unknown>;
    failureSummary?: SessionFailureSummaryRecord;
}

export type QueueJobData = Record<string, unknown>;

export const hasJobProps = (job: unknown): job is Job => {
    return isRecord(job) && isRecord(job.props);
};
