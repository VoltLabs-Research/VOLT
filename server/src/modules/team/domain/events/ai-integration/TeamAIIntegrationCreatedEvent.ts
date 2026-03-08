import { createTeamDomainEvent } from '@modules/team/domain/events/team/createTeamDomainEvent';
import { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';

export interface TeamAIIntegrationCreatedEventPayload {
    teamAIIntegrationId: string;
    teamId: string;
    provider: TeamAIProvider;
    isEnabled: boolean;
    defaultModel?: string;
};

export default class TeamAIIntegrationCreatedEvent extends createTeamDomainEvent<TeamAIIntegrationCreatedEventPayload>('team-ai-integration.created') {};
