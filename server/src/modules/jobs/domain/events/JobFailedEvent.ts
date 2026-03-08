import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface JobFailureDetails {
    code: string;
    message: string;
    details?: string;
}

export interface JobFailedEventPayload {
    jobId: string;
    teamId: string;
    queueType: string;
    error: string;
    failure: JobFailureDetails;
    metadata?: Record<string, unknown>;
    failedAt: Date;
}

export default class JobFailedEvent extends BaseDomainEvent<JobFailedEventPayload> {
    constructor(payload: JobFailedEventPayload) {
        super('job.failed', payload);
    }
}
