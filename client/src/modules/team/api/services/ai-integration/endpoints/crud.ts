import { get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { GetTeamAIIntegrationsInputDTO, ListTeamAIIntegrationsResponse } from '../../../dtos/get-team-ai-integrations';
import type { CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationResponse } from '../../../dtos/create-team-ai-integration';
import type { UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationResponse } from '../../../dtos/update-team-ai-integration';
import type { DeleteTeamAIIntegrationInputDTO } from '../../../dtos/delete-team-ai-integration';

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
    )
};

export default endpoints;
