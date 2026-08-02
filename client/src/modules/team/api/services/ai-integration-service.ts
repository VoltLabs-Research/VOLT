import { createService, get, post, patch, del } from '@/app/core/http/utils/create-service';

import type { AIProvider } from '@volt/contracts/modules/ai/domain';
import type { TeamScopedParams } from '@/shared/api/request-params';
import type {
    GetTeamAIIntegrationModelsResponse,
    GetTeamAIIntegrationsResponse,
    TeamAIIntegrationMutationResponse
} from '@volt/contracts/modules/team/domain';
import type { TeamAIIntegrationMutationInput } from '@volt/contracts/modules/team/http';

export type TeamAIIntegrationProviderInput = TeamScopedParams & {
    provider: AIProvider;
} & TeamAIIntegrationMutationInput;

export interface DeleteTeamAIIntegrationInput extends TeamScopedParams {
    provider: AIProvider;
}

const endpoints = {
    listByTeamId: get<TeamScopedParams, GetTeamAIIntegrationsResponse>(
        '/:teamId/ai-integrations'
    ),
    createByProvider: post<TeamAIIntegrationProviderInput, TeamAIIntegrationMutationResponse>(
        '/:teamId/ai-integrations/:provider'
    ),
    updateByProvider: patch<TeamAIIntegrationProviderInput, TeamAIIntegrationMutationResponse>(
        '/:teamId/ai-integrations/:provider'
    ),
    deleteByProvider: del<DeleteTeamAIIntegrationInput>(
        '/:teamId/ai-integrations/:provider'
    ),
    listModels: get<TeamScopedParams, GetTeamAIIntegrationModelsResponse>(
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
