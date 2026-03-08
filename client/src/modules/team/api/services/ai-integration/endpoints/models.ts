import { get, post } from '@/app/core/http/utilities/create-service';
import type { GetTeamAIIntegrationModelsInputDTO, ListTeamAIIntegrationModelsResponse } from '../../../dtos/ai-integration/get-team-ai-integration-models';
import type { DiscoverTeamAIProviderModelsInputDTO, DiscoverTeamAIProviderModelsOutputDTO } from '../../../dtos/ai-integration/discover-team-ai-provider-models';

export default {
    listModels: get<GetTeamAIIntegrationModelsInputDTO, ListTeamAIIntegrationModelsResponse>(
        '/:teamId/ai-integrations/models'
    ),
    discoverModels: post<DiscoverTeamAIProviderModelsInputDTO, DiscoverTeamAIProviderModelsOutputDTO>(
        '/:teamId/ai-integrations/model-discovery'
    )
};
