import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TeamRoleDeletedEventPayload {
    teamRoleId: string;
    teamId: string;
}

export default class TeamRoleDeletedEvent implements IDomainEvent {
    public readonly name = 'team-role.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamRoleDeletedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
