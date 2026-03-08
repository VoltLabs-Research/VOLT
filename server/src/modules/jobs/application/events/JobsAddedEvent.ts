import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface JobsAddedEventPayload {
    sessionId: string;
    queueType: string;
    teamId: string;
    count: number;
    metadata?: Record<string, unknown>;
}

export default class JobsAddedEvent extends BaseDomainEvent<JobsAddedEventPayload> {
    constructor(payload: JobsAddedEventPayload) {
        super('jobs.added', payload);
    }
}
