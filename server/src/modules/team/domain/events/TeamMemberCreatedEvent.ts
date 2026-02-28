import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TeamMemberCreatedEventPayload {
    teamMemberId: string;
    teamId: string;
    userId: string;
    roleId: string;
}

export default class TeamMemberCreatedEvent implements IDomainEvent {
    public readonly name = 'team-member.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamMemberCreatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
