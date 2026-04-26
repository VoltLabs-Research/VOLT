import { JobStatus } from '@modules/jobs/domain/entities/Job';

// TODO: This should live in port
export type TeamJobStatus = JobStatus | 'partial';

export interface TeamJobSnapshot {
    jobId: string;
    name?: string;
    teamId: string;
    teamClusterId?: string;
    queueType: string;
    status: TeamJobStatus;
    sessionId?: string;
    message?: string;
    error?: string;
    timestamp?: string;
    createdAt?: string;
    updatedAt?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    source?: string;
    backingSource?: string;
    cleanupScope?: string;
    revision?: number;
    [key: string]: unknown;
}
