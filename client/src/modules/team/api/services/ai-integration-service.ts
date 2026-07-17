import { createService, get, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { AIProvider } from '@/modules/ai/api/types/ai-provider';
import type {
    AIProviderCatalogItem,
    TeamAIIntegration,
    TeamAIModelListItem,
    TeamAIModelMetadata,
    TeamAIProviderModelsCatalog
} from '../types/ai-integration/team-ai-integration';

export interface CreateTeamAIIntegrationParams {
    apiKey?: string;
    isEnabled?: boolean;
    defaultModel?: string;
    enabledModels?: TeamAIModelMetadata[];
    metadata?: Record<string, unknown>;
}

export interface CreateTeamAIIntegrationResponse {
    integration: TeamAIIntegration;
}

export type CreateTeamAIIntegrationInput = {
    teamId: string;
    provider: AIProvider;
} & CreateTeamAIIntegrationParams;

export interface DeleteTeamAIIntegrationInput {
    teamId: string;
    provider: AIProvider;
}

export interface ListTeamAIIntegrationModelsResponse {
    teamId: string;
    providers: TeamAIProviderModelsCatalog[];
    models: TeamAIModelListItem[];
}

export interface GetTeamAIIntegrationModelsInput {
    teamId: string;
}

export interface ListTeamAIIntegrationsResponse {
    teamId: string;
    integrations: TeamAIIntegration[];
    providers: AIProviderCatalogItem[];
}

export interface GetTeamAIIntegrationsInput {
    teamId: string;
}

export type UpdateTeamAIIntegrationParams = CreateTeamAIIntegrationParams;

export interface UpdateTeamAIIntegrationResponse {
    integration: TeamAIIntegration;
}

export type UpdateTeamAIIntegrationInput = {
    teamId: string;
    provider: AIProvider;
} & UpdateTeamAIIntegrationParams;

const endpoints = {
    listByTeamId: get<GetTeamAIIntegrationsInput, ListTeamAIIntegrationsResponse>(
        '/:teamId/ai-integrations'
    ),
    createByProvider: post<CreateTeamAIIntegrationInput, CreateTeamAIIntegrationResponse>(
        '/:teamId/ai-integrations/:provider'
    ),
    updateByProvider: patch<UpdateTeamAIIntegrationInput, UpdateTeamAIIntegrationResponse>(
        '/:teamId/ai-integrations/:provider'
    ),
    deleteByProvider: del<DeleteTeamAIIntegrationInput>(
        '/:teamId/ai-integrations/:provider'
    ),
    listModels: get<GetTeamAIIntegrationModelsInput, ListTeamAIIntegrationModelsResponse>(
        '/:teamId/ai-integrations/models'
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
