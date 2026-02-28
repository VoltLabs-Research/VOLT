import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TeamRoleUpdatedEventPayload {
    teamRoleId: string;
    teamId: string;
    name?: string;
    permissions?: string[];
}

export default class TeamRoleUpdatedEvent implements IDomainEvent {
    public readonly name = 'team-role.updated';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamRoleUpdatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
