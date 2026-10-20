import { createService, serviceRoutes } from '@/app/core/http/utils/create-service';
import { teamAIIntegrationRoutes } from '@volt/contracts/modules/team/routes';

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

const routes = serviceRoutes('/teams');

const endpoints = {
    listByTeamId: routes.route<TeamScopedParams, GetTeamAIIntegrationsResponse>(
        teamAIIntegrationRoutes.list
    ),
    createByProvider: routes.route<TeamAIIntegrationProviderInput, TeamAIIntegrationMutationResponse>(
        teamAIIntegrationRoutes.createByProvider
    ),
    updateByProvider: routes.route<TeamAIIntegrationProviderInput, TeamAIIntegrationMutationResponse>(
        teamAIIntegrationRoutes.updateByProvider
    ),
    deleteByProvider: routes.route<DeleteTeamAIIntegrationInput, void>(
        teamAIIntegrationRoutes.deleteByProvider, { unwrap: 'void' }
    ),
    listModels: routes.route<TeamScopedParams, GetTeamAIIntegrationModelsResponse>(
        teamAIIntegrationRoutes.listModels
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
