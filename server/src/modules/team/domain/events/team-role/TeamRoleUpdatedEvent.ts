import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';

export interface TeamRoleUpdatedEventPayload {
    teamRoleId: string;
    teamId: string;
    name?: string;
    permissions?: string[];
}

export default class TeamRoleUpdatedEvent extends createTeamDomainEvent<TeamRoleUpdatedEventPayload>('team-role.updated') {}
