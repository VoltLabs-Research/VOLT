import { get } from '@/app/core/http/utilities/create-service';
import type { GetTeamAIIntegrationModelsInputDTO, ListTeamAIIntegrationModelsResponse } from '../../../dtos/ai-integration/get-team-ai-integration-models';

export default {
    listModels: get<GetTeamAIIntegrationModelsInputDTO, ListTeamAIIntegrationModelsResponse>(
        '/:teamId/ai-integrations/models'
    )
};
