import { get, post } from '@/app/core/http/utilities/create-service';
import type { GetTeamAIIntegrationModelsInputDTO, ListTeamAIIntegrationModelsResponse } from '../../../dtos/get-team-ai-integration-models';
import type { DiscoverTeamAIProviderModelsInputDTO, DiscoverTeamAIProviderModelsOutputDTO } from '../../../dtos/discover-team-ai-provider-models';

const endpoints = {
    listModels: get<GetTeamAIIntegrationModelsInputDTO, ListTeamAIIntegrationModelsResponse>(
        '/:teamId/ai-integrations/models'
    ),
    discoverModels: post<DiscoverTeamAIProviderModelsInputDTO, DiscoverTeamAIProviderModelsOutputDTO>(
        '/:teamId/ai-integrations/model-discovery'
    )
};

export default endpoints;
