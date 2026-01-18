import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface JobStatusChangedEventData{
    jobId: string;
    teamId: string;
    status: JobStatus;
    queueType: string;
    metadata?: Record<string, any>;
};

export default class JobStatusChangedEvent implements IDomainEvent {
    public readonly name = 'job.status.changed';
    public readonly eventId: string;
    public readonly occurredOn: Date;

    constructor(public readonly data: JobStatusChangedEventData){
        this.eventId = v4();
        this.occurredOn = new Date();
    }
};