import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface JobCompletedEventPayload {
    jobId: string;
    teamId: string;
    queueType: string;
    metadata?: Record<string, unknown>;
    completedAt: Date;
}

export default class JobCompletedEvent extends BaseDomainEvent<JobCompletedEventPayload> {
    constructor(payload: JobCompletedEventPayload) {
        super('job.completed', payload);
    }
}
