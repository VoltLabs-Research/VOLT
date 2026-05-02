import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

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

export default class JobStatusChangedEvent extends BaseDomainEvent<JobStatusChangedEventPayload> {
    constructor(payload: JobStatusChangedEventPayload) {
        super('job.status.changed', payload);
    }
}
