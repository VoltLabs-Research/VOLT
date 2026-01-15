import { IDomainEvent } from '@/src/shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TeamDeletedEventPayload{
    teamId: string;
};

export default class TeamDeletedEvent implements IDomainEvent{
    public readonly name = 'team.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamDeletedEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
};