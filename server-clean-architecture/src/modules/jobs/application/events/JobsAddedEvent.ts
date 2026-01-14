import { IDomainEvent } from "@/src/shared/application/events/IDomainEvent";
import { v4 } from "uuid";

export interface JobsAddedEventData {
    sessionId: string;
    queueType: string;
    teamId: string;
    count: number;
    metadata?: Record<string, any>;
}

export default class JobsAddedEvent implements IDomainEvent {
    public readonly name = 'jobs.added';
    public readonly eventId: string;
    public readonly occurredOn: Date;

    constructor(public readonly data: JobsAddedEventData) {
        this.eventId = v4();
        this.occurredOn = new Date();
    }
}