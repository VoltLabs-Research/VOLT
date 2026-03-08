import { JobStatus } from '@modules/jobs/domain/entities/Job';

export type TeamJobStatus = JobStatus | 'retrying' | 'partial';

export interface TeamJobMetadata {
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    analysisId?: string;
    message?: string;
    [key: string]: unknown;
}

export interface TeamJobSnapshot {
    jobId: string;
    teamId: string;
    queueType: string;
    status: TeamJobStatus;
    sessionId?: string;
    message?: string;
    metadata?: TeamJobMetadata;
    timestamp?: string;
    createdAt?: string;
    updatedAt?: string;
    analysisId?: string;
    trajectoryId?: string;
    timestep?: number;
    [key: string]: unknown;
}
