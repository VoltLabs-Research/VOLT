import { TeamScopedInputDTO } from '@modules/team/application/dtos/common';
import { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';

export interface DiscoverTeamAIProviderModelDTO {
    id: string;
    name: string;
    description?: string;
};

export interface DiscoverTeamAIProviderModelsInputDTO extends TeamScopedInputDTO {
    provider: TeamAIProvider;
    apiKey?: string;
    metadata?: Record<string, unknown>;
};

export interface DiscoverTeamAIProviderModelsOutputDTO {
    teamId: string;
    provider: TeamAIProvider;
    providerName: string;
    defaultModel: string | null;
    metadata?: Record<string, unknown>;
    models: DiscoverTeamAIProviderModelDTO[];
};
