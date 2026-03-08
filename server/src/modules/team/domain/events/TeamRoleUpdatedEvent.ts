import { createTeamDomainEvent } from './createTeamDomainEvent';

export interface TeamRoleUpdatedEventPayload {
    teamRoleId: string;
    teamId: string;
    name?: string;
    permissions?: string[];
}

export default class TeamRoleUpdatedEvent extends createTeamDomainEvent<TeamRoleUpdatedEventPayload>('team-role.updated') {}
