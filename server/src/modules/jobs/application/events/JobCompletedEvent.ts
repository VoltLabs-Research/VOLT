import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface JobCompletedEventData {
    jobId: string;
    teamId: string;
    queueType: string;
    metadata?: Record<string, any>;
    completedAt: Date;
};

export default class JobCompletedEvent implements IDomainEvent {
    public readonly name = 'job.completed';
    public readonly eventId: string;
    public readonly occurredOn: Date;

    constructor(public readonly data: JobCompletedEventData) {
        this.eventId = v4();
        this.occurredOn = new Date();
    }
};