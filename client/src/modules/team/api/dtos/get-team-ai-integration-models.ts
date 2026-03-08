import type { TeamAIProviderModelsCatalog, TeamAIModelListItem } from '../entities/team-ai-integration';

export interface ListTeamAIIntegrationModelsResponse {
    teamId: string;
    providers: TeamAIProviderModelsCatalog[];
    models: TeamAIModelListItem[];
};

export interface GetTeamAIIntegrationModelsInputDTO {
    teamId: string;
};

export type GetTeamAIIntegrationModelsOutputDTO = ListTeamAIIntegrationModelsResponse;
