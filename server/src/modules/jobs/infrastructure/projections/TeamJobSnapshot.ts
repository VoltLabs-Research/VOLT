import { JobStatus } from '@modules/jobs/domain/entities/Job';

// TODO: This should live in port
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
    name?: string;
    teamId: string;
    teamClusterId?: string;
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
    trajectoryName?: string;
    timestep?: number;
    [key: string]: unknown;
}
