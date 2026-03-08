import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface JobStatusChangedEventPayload {
    jobId: string;
    teamId: string;
    status: JobStatus;
    queueType: string;
    metadata?: Record<string, unknown>;
}

export default class JobStatusChangedEvent extends BaseDomainEvent<JobStatusChangedEventPayload> {
    constructor(payload: JobStatusChangedEventPayload) {
        super('job.status.changed', payload);
    }
}
