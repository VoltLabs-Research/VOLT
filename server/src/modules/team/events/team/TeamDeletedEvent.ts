import { createTeamDomainEvent } from '@modules/team/events/team/createTeamDomainEvent';

export interface TeamDeletedEventPayload {
    teamId: string;
    userId?: string;
}

export default class TeamDeletedEvent extends createTeamDomainEvent<TeamDeletedEventPayload>('team.deleted') {}
