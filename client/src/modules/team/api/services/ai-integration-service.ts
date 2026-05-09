import { createService, get, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type {
    AIProviderCatalogItem,
    TeamAIIntegration,
    TeamAIModelListItem,
    TeamAIModelMetadata,
    TeamAIProviderModelsCatalog
} from '../entities/ai-integration/team-ai-integration';

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

export type CreateTeamAIIntegrationInputDTO = {
    teamId: string;
    provider: AIProvider;
} & CreateTeamAIIntegrationParams;

export interface DeleteTeamAIIntegrationInputDTO {
    teamId: string;
    provider: AIProvider;
}

export interface ListTeamAIIntegrationModelsResponse {
    teamId: string;
    providers: TeamAIProviderModelsCatalog[];
    models: TeamAIModelListItem[];
}

export interface GetTeamAIIntegrationModelsInputDTO {
    teamId: string;
}

export interface ListTeamAIIntegrationsResponse {
    teamId: string;
    integrations: TeamAIIntegration[];
    providers: AIProviderCatalogItem[];
}

export interface GetTeamAIIntegrationsInputDTO {
    teamId: string;
}

export type UpdateTeamAIIntegrationParams = CreateTeamAIIntegrationParams;

export interface UpdateTeamAIIntegrationResponse {
    integration: TeamAIIntegration;
}

export type UpdateTeamAIIntegrationInputDTO = {
    teamId: string;
    provider: AIProvider;
} & UpdateTeamAIIntegrationParams;

const endpoints = {
    listByTeamId: get<GetTeamAIIntegrationsInputDTO, ListTeamAIIntegrationsResponse>(
        '/:teamId/ai-integrations'
    ),
    createByProvider: post<CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationResponse>(
        '/:teamId/ai-integrations/:provider'
    ),
    updateByProvider: patch<UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationResponse>(
        '/:teamId/ai-integrations/:provider'
    ),
    deleteByProvider: del<DeleteTeamAIIntegrationInputDTO>(
        '/:teamId/ai-integrations/:provider'
    ),
    listModels: get<GetTeamAIIntegrationModelsInputDTO, ListTeamAIIntegrationModelsResponse>(
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
