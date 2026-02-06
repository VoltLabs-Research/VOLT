import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TeamMemberLeaveEventPayload{
    teamId: string;
    memberId: string;
};

export default class TeamMemberLeaveEvent implements IDomainEvent{
    public readonly name = 'team.member.leave';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TeamMemberLeaveEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
};