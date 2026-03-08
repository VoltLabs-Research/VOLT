import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';

export interface TeamRoleCreatedEventPayload {
    teamRoleId: string;
    teamId: string;
    name: string;
};

export default class TeamRoleCreatedEvent extends createTeamDomainEvent<TeamRoleCreatedEventPayload>('team-role.created') {};
