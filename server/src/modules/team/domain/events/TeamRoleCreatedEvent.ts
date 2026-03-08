import { createTeamDomainEvent } from './createTeamDomainEvent';

export interface TeamRoleCreatedEventPayload {
    teamRoleId: string;
    teamId: string;
    name: string;
}

export default class TeamRoleCreatedEvent extends createTeamDomainEvent<TeamRoleCreatedEventPayload>('team-role.created') {}
