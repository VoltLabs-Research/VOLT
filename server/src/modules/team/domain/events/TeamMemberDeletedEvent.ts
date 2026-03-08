import { createTeamDomainEvent } from './createTeamDomainEvent';

export interface TeamMemberDeletedEventPayload {
    teamMemberId: string;
    teamId: string;
}

export default class TeamMemberDeletedEvent extends createTeamDomainEvent<TeamMemberDeletedEventPayload>('team-member.deleted') {}
