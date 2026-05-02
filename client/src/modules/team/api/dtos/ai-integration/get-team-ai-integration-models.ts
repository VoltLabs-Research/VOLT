import type { TeamAIProviderModelsCatalog, TeamAIModelListItem } from '../../entities/ai-integration/team-ai-integration';

export interface ListTeamAIIntegrationModelsResponse {
    teamId: string;
    providers: TeamAIProviderModelsCatalog[];
    models: TeamAIModelListItem[];
}

export interface GetTeamAIIntegrationModelsInputDTO {
    teamId: string;
}
