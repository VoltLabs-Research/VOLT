import { createTeamDomainEvent } from './createTeamDomainEvent';

export interface TeamCreatedEventPayload {
    teamId: string;
    ownerId: string;
}

export default class TeamCreatedEvent extends createTeamDomainEvent<TeamCreatedEventPayload>('team.created') {}
