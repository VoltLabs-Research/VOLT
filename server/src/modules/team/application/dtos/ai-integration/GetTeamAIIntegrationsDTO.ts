import { TeamScopedInputDTO } from '@modules/team/application/dtos/common';
import { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';

export type GetTeamAIIntegrationsInputDTO = TeamScopedInputDTO;

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
};

export interface TeamAIProviderCatalogItemDTO {
    id: TeamAIProvider;
    name: string;
    description: string;
};

export interface GetTeamAIIntegrationsOutputDTO {
    teamId: string;
    integrations: TeamAIIntegrationItemDTO[];
    providers: TeamAIProviderCatalogItemDTO[];
};
