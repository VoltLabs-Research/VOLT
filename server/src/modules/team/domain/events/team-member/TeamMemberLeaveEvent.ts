import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';

export interface TeamMemberLeaveEventPayload {
    teamId: string;
    memberId: string;
};

export default class TeamMemberLeaveEvent extends createTeamDomainEvent<TeamMemberLeaveEventPayload>('team-member.left') {};
