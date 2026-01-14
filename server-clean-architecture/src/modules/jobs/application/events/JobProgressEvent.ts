import { IDomainEvent } from "../../../../shared/application/events/IDomainEvent";
import { v4 } from "uuid";

export interface JobProgressEventData {
    jobId: string;
    teamId: string;
    queueType: string;
    progress: number;
    message?: string;
    metadata?: Record<string, any>;
}

export default class JobProgressEvent implements IDomainEvent {
    public readonly name = 'job.progress';
    public readonly eventId: string;
    public readonly occurredOn: Date;

    constructor(public readonly data: JobProgressEventData) {
        this.eventId = v4();
        this.occurredOn = new Date();
    }
}