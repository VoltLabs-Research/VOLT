import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface JobIncrementedEventPayload {
    jobId: string;
    teamId: string;
    queueType: string;
    sessionId: string;
    metadata?: Record<string, unknown>;
}

export default class JobIncrementedEvent extends BaseDomainEvent<JobIncrementedEventPayload> {
    constructor(payload: JobIncrementedEventPayload) {
        super('job.incremented', payload);
    }
}
