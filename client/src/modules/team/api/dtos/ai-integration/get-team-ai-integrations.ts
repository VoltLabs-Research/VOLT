import type { AIProviderCatalogItem, TeamAIIntegration } from '../../entities/ai-integration';

export interface ListTeamAIIntegrationsResponse {
    teamId: string;
    integrations: TeamAIIntegration[];
    providers: AIProviderCatalogItem[];
};

export interface GetTeamAIIntegrationsInputDTO {
    teamId: string;
};

export type GetTeamAIIntegrationsOutputDTO = ListTeamAIIntegrationsResponse;
