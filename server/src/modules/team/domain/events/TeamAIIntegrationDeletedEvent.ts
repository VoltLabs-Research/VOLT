import { createTeamDomainEvent } from './createTeamDomainEvent';
import { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';

export interface TeamAIIntegrationDeletedEventPayload {
    teamAIIntegrationId: string;
    teamId: string;
    provider: TeamAIProvider;
}

export default class TeamAIIntegrationDeletedEvent extends createTeamDomainEvent<TeamAIIntegrationDeletedEventPayload>('team-ai-integration.deleted') {}
