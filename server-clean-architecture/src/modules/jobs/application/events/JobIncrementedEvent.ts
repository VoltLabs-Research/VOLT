import { IDomainEvent } from '@/src/shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface JobIncrementedEventData {
    jobId: string;
    teamId: string;
    queueType: string;
    sessionId: string;
    metadata?: Record<string, any>;
}

export default class JobIncrementedEvent implements IDomainEvent {
    public readonly name = 'job.incremented';
    public readonly eventId: string;
    public readonly occurredOn: Date;

    constructor(public readonly data: JobIncrementedEventData) {
        this.eventId = v4();
        this.occurredOn = new Date();
    }
}