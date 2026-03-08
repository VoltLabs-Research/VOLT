import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';

export interface TeamRoleDeletedEventPayload {
    teamRoleId: string;
    teamId: string;
};

export default class TeamRoleDeletedEvent extends createTeamDomainEvent<TeamRoleDeletedEventPayload>('team-role.deleted') {};
