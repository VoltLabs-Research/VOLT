import { TeamAIIntegrationItemDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';

export interface CreateTeamAIIntegrationInputDTO {
    teamId: string;
    provider: string;
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
    userId: string;
}

export interface CreateTeamAIIntegrationOutputDTO {
    integration: TeamAIIntegrationItemDTO;
}
