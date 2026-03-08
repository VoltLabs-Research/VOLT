import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';

export interface TeamMemberDeletedEventPayload {
    teamMemberId: string;
    teamId: string;
};

export default class TeamMemberDeletedEvent extends createTeamDomainEvent<TeamMemberDeletedEventPayload>('team-member.deleted') {};
