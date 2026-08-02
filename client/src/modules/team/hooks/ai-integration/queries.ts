import aiIntegrationService from '../../api/services/ai-integration-service';
import { buildKeys, createMutation, createQuery, queryClient } from '@/shared/query';
import type {
    DeleteTeamAIIntegrationInput,
    TeamAIIntegrationProviderInput
} from '../../api/services/ai-integration-service';
import type {
    GetTeamAIIntegrationModelsResponse,
    GetTeamAIIntegrationsResponse,
    TeamAIIntegrationMutationResponse
} from '@volt/contracts/modules/team/domain';

const aiIntegrationKeys = buildKeys<{
    aiIntegrations: void;
    teamAIIntegrations: string;
}>('team-ai-integrations');

const aiIntegrationModelKeys = buildKeys<{
    aiIntegrationModels: void;
    teamAIIntegrationModels: string;
}>('team-ai-integration-models');

export const AI_INTEGRATION_QUERY_KEYS = {
    aiIntegrations: aiIntegrationKeys.aiIntegrations,
    teamAIIntegrations: aiIntegrationKeys.teamAIIntegrations,
    aiIntegrationModels: aiIntegrationModelKeys.aiIntegrationModels,
    teamAIIntegrationModels: aiIntegrationModelKeys.teamAIIntegrationModels
};

export const invalidateTeamAIIntegrationsQuery = (teamId: string) => {
    return Promise.all([
        queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrations(teamId) }),
        queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrationModels(teamId) })
    ]);
};

export const useTeamAIIntegrationsQuery = createQuery<string, GetTeamAIIntegrationsResponse>(
    AI_INTEGRATION_QUERY_KEYS.teamAIIntegrations,
    (teamId: string) => {
        return aiIntegrationService.listByTeamId({ teamId });
    }
);

export const useTeamAIIntegrationModelsQuery = createQuery<string, GetTeamAIIntegrationModelsResponse>(
    AI_INTEGRATION_QUERY_KEYS.teamAIIntegrationModels,
    (teamId: string) => {
        return aiIntegrationService.listModels({ teamId });
    }
);

export const useCreateTeamAIIntegrationMutation = createMutation<
    TeamAIIntegrationMutationResponse,
    TeamAIIntegrationProviderInput
>(
    aiIntegrationService.createByProvider,
    async (_data, variables) => {
        await invalidateTeamAIIntegrationsQuery(variables.teamId);
    }
);

export const useUpdateTeamAIIntegrationMutation = createMutation<
    TeamAIIntegrationMutationResponse,
    TeamAIIntegrationProviderInput
>(
    aiIntegrationService.updateByProvider,
    async (_data, variables) => {
        await invalidateTeamAIIntegrationsQuery(variables.teamId);
    }
);

export const useDeleteTeamAIIntegrationMutation = createMutation<void, DeleteTeamAIIntegrationInput>(
    aiIntegrationService.deleteByProvider,
    async (_data, variables) => {
        await invalidateTeamAIIntegrationsQuery(variables.teamId);
    }
);
