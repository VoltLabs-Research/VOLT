import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';
import { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';

export interface TeamAIIntegrationDeletedEventPayload {
    teamAIIntegrationId: string;
    teamId: string;
    provider: TeamAIProvider;
};

export default class TeamAIIntegrationDeletedEvent extends createTeamDomainEvent<TeamAIIntegrationDeletedEventPayload>('team-ai-integration.deleted') {};
