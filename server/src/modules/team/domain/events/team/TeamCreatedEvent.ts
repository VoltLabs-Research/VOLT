import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';

export interface TeamCreatedEventPayload {
    teamId: string;
    ownerId: string;
};

export default class TeamCreatedEvent extends createTeamDomainEvent<TeamCreatedEventPayload>('team.created') {};
