import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface JobStatusChangedMetadata {
    jobId?: string;
    analysisId?: string;
    status?: JobStatus;
    queueType?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    message?: string;
    error?: string;
    [key: string]: unknown;
};

export interface JobStatusChangedEventPayload {
    jobId: string;
    teamId: string;
    status: JobStatus;
    queueType: string;
    metadata?: JobStatusChangedMetadata;
};

export default class JobStatusChangedEvent extends BaseDomainEvent<JobStatusChangedEventPayload> {
    constructor(payload: JobStatusChangedEventPayload) {
        super('job.status.changed', payload);
    }
};
