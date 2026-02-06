import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface JobFailedEventData {
    jobId: string;
    teamId: string;
    queueType: string;
    error: string;
    metadata?: Record<string, any>;
    failedAt: Date;
};

export default class JobFailedEvent implements IDomainEvent {
    public readonly name = 'job.failed';
    public readonly eventId: string;
    public readonly occurredOn: Date;

    constructor(public readonly data: JobFailedEventData) {
        this.eventId = v4();
        this.occurredOn = new Date();
    }
};