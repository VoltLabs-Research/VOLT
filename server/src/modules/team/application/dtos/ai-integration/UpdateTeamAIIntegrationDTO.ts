import { TeamAIIntegrationItemDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';

export interface UpdateTeamAIIntegrationInputDTO {
    teamId: string;
    provider: string;
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
}

export interface UpdateTeamAIIntegrationOutputDTO {
    integration: TeamAIIntegrationItemDTO;
}
