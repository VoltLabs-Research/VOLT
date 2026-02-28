import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TeamRoleCreatedEventPayload {
    teamRoleId: string;
    teamId: string;
    name: string;
}

export default class TeamRoleCreatedEvent implements IDomainEvent {
    public readonly name = 'team-role.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamRoleCreatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
