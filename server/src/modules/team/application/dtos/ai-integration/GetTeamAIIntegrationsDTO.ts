import { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';

export interface GetTeamAIIntegrationsInputDTO {
    teamId: string;
}

export interface TeamAIIntegrationItemDTO {
    _id: string;
    teamId: string;
    provider: TeamAIProvider;
    providerName: string;
    isEnabled: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
    hasApiKey: boolean;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface GetTeamAIIntegrationsOutputDTO {
    teamId: string;
    integrations: TeamAIIntegrationItemDTO[];
}
