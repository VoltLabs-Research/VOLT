import { createTeamDomainEvent } from './createTeamDomainEvent';
import { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';

export interface TeamAIIntegrationUpdatedEventPayload {
    teamAIIntegrationId: string;
    teamId: string;
    provider: TeamAIProvider;
    isEnabled: boolean;
    defaultModel?: string;
}

export default class TeamAIIntegrationUpdatedEvent extends createTeamDomainEvent<TeamAIIntegrationUpdatedEventPayload>('team-ai-integration.updated') {}
