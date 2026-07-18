
import type { JobStatus } from '@shared/contracts/types/JobStatus';

export interface JobStatusChangedEventPayload {
    jobId: string;
    teamId: string;
    status: JobStatus;
    queueType: string;
    name?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    message?: string;
    error?: string;
    teamClusterId?: string;
    source?: string;
    backingSource?: string;
    cleanupScope?: string;
    [key: string]: unknown;
}
