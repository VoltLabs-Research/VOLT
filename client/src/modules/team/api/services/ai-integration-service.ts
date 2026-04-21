import { get, post, patch, del } from '@/app/core/http/utilities/create-service';
import { defineServiceModule } from '@/shared/api/service-module';
import type { GetTeamAIIntegrationsInputDTO, ListTeamAIIntegrationsResponse } from '../dtos/ai-integration/get-team-ai-integrations';
import type { CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationResponse } from '../dtos/ai-integration/create-team-ai-integration';
import type { UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationResponse } from '../dtos/ai-integration/update-team-ai-integration';
import type { DeleteTeamAIIntegrationInputDTO } from '../dtos/ai-integration/delete-team-ai-integration';
import type { GetTeamAIIntegrationModelsInputDTO, ListTeamAIIntegrationModelsResponse } from '../dtos/ai-integration/get-team-ai-integration-models';

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

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/teams'
        }
    },
    endpoints
});
