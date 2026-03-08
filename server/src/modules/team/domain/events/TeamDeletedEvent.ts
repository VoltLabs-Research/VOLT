import { createTeamDomainEvent } from './createTeamDomainEvent';

export interface TeamDeletedEventPayload {
    teamId: string;
}

export default class TeamDeletedEvent extends createTeamDomainEvent<TeamDeletedEventPayload>('team.deleted') {}
