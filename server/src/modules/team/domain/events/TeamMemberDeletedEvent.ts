import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TeamMemberDeletedEventPayload {
    teamMemberId: string;
    teamId: string;
}

export default class TeamMemberDeletedEvent implements IDomainEvent {
    public readonly name = 'team-member.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamMemberDeletedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
