import { createTeamDomainEvent } from './createTeamDomainEvent';
import { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';

export interface TeamAIIntegrationCreatedEventPayload {
    teamAIIntegrationId: string;
    teamId: string;
    provider: TeamAIProvider;
    isEnabled: boolean;
    defaultModel?: string;
}

export default class TeamAIIntegrationCreatedEvent extends createTeamDomainEvent<TeamAIIntegrationCreatedEventPayload>('team-ai-integration.created') {}
