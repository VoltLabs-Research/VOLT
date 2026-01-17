import { IDomainEvent } from '@/src/shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TeamCreatedEventPayload{
    teamId: string;
    ownerId: string;
};

export default class TeamCreatedEvent implements IDomainEvent{
    public readonly name = 'team.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamCreatedEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
};