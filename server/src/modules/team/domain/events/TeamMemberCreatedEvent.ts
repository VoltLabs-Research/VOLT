import { createTeamDomainEvent } from './createTeamDomainEvent';

export interface TeamMemberCreatedEventPayload {
    teamMemberId: string;
    teamId: string;
    userId: string;
    roleId: string;
}

export default class TeamMemberCreatedEvent extends createTeamDomainEvent<TeamMemberCreatedEventPayload>('team-member.created') {}
