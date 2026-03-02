import type {
    TeamAIIntegration,
    TeamAIModelListItem,
    TeamAIProvider,
    TeamAIProviderModelsCatalog
} from '@/modules/team/domain/entities/TeamAIIntegration';

export interface ListTeamAIIntegrationsResponse {
    teamId: string;
    integrations: TeamAIIntegration[];
}

export interface CreateTeamAIIntegrationParams {
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
}

export interface CreateTeamAIIntegrationResponse {
    integration: TeamAIIntegration;
}

export interface UpdateTeamAIIntegrationParams {
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: string[];
    metadata?: Record<string, unknown>;
}

export interface UpdateTeamAIIntegrationResponse {
    integration: TeamAIIntegration;
}

export interface ListTeamAIIntegrationModelsResponse {
    teamId: string;
    providers: TeamAIProviderModelsCatalog[];
    models: TeamAIModelListItem[];
}

export default interface ITeamAIIntegrationRepository {
    listByTeamId(teamId: string): Promise<ListTeamAIIntegrationsResponse>;
    createByProvider(teamId: string, provider: TeamAIProvider, data: CreateTeamAIIntegrationParams): Promise<CreateTeamAIIntegrationResponse>;
    updateByProvider(teamId: string, provider: TeamAIProvider, data: UpdateTeamAIIntegrationParams): Promise<UpdateTeamAIIntegrationResponse>;
    deleteByProvider(teamId: string, provider: TeamAIProvider): Promise<void>;
    listModels(teamId: string): Promise<ListTeamAIIntegrationModelsResponse>;
}
