import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface SessionCompletedEventData{
    sessionId: string;
    teamId: string;
    queueType: string;
    totalJobs: number;
    startTime: Date;
    completedAt: Date;
    metadata?: Record<string, any>;
};

export default class SessionCompletedEvent implements IDomainEvent{
    public readonly name = 'session.completed';
    public readonly eventId: string;
    public readonly occurredOn: Date;

    constructor(public readonly data: SessionCompletedEventData){
        this.eventId = v4();
        this.occurredOn = new Date();
    }
};