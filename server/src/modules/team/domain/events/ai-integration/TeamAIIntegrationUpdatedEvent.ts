import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';
import { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';

export interface TeamAIIntegrationUpdatedEventPayload {
    teamAIIntegrationId: string;
    teamId: string;
    provider: TeamAIProvider;
    isEnabled: boolean;
    defaultModel?: string;
}

export default class TeamAIIntegrationUpdatedEvent extends createTeamDomainEvent<TeamAIIntegrationUpdatedEventPayload>('team-ai-integration.updated') {}
