import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';

export interface TeamDeletedEventPayload {
    teamId: string;
};

export default class TeamDeletedEvent extends createTeamDomainEvent<TeamDeletedEventPayload>('team.deleted') {};
