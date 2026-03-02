import { TeamAIProvider } from '@modules/team/domain/entities/TeamAIIntegration';

export interface TeamAIModelMetadataDTO {
    id: string;
    name: string;
    description?: string;
}

export interface GetTeamAIIntegrationModelsInputDTO {
    teamId: string;
}

export interface TeamAIProviderModelsDTO {
    provider: TeamAIProvider;
    providerName: string;
    defaultModel?: string;
    metadata?: Record<string, unknown>;
    models: TeamAIModelMetadataDTO[];
}

export interface TeamAIModelListItemDTO extends TeamAIModelMetadataDTO {
    provider: TeamAIProvider;
    providerName: string;
    isDefault: boolean;
}

export interface GetTeamAIIntegrationModelsOutputDTO {
    teamId: string;
    providers: TeamAIProviderModelsDTO[];
    models: TeamAIModelListItemDTO[];
}
