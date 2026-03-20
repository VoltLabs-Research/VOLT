import aiIntegrationService from '../../api/services/ai-integration';
import { buildKeys, createMutation, createQuery, queryClient } from '@/shared/infrastructure/query';
import type { CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationResponse } from '../../api/dtos/ai-integration/create-team-ai-integration';
import type { DeleteTeamAIIntegrationInputDTO } from '../../api/dtos/ai-integration/delete-team-ai-integration';
import type { ListTeamAIIntegrationModelsResponse } from '../../api/dtos/ai-integration/get-team-ai-integration-models';
import type { ListTeamAIIntegrationsResponse } from '../../api/dtos/ai-integration/get-team-ai-integrations';
import type { UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationResponse } from '../../api/dtos/ai-integration/update-team-ai-integration';

interface AIIntegrationQueryKeyMap {
    aiIntegrations: void;
    teamAIIntegrations: string;
};

interface AIIntegrationModelsQueryKeyMap {
    aiIntegrationModels: void;
    teamAIIntegrationModels: string;
};

const aiIntegrationKeys = buildKeys<AIIntegrationQueryKeyMap>('team-ai-integrations');

const aiIntegrationModelKeys = buildKeys<AIIntegrationModelsQueryKeyMap>('team-ai-integration-models');

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

export const useTeamAIIntegrationsQuery = createQuery<string, ListTeamAIIntegrationsResponse>(
    AI_INTEGRATION_QUERY_KEYS.teamAIIntegrations,
    (teamId: string) => {
        return aiIntegrationService.listByTeamId({ teamId });
    }
);

export const useTeamAIIntegrationModelsQuery = createQuery<string, ListTeamAIIntegrationModelsResponse>(
    AI_INTEGRATION_QUERY_KEYS.teamAIIntegrationModels,
    (teamId: string) => {
        return aiIntegrationService.listModels({ teamId });
    }
);

export const useCreateTeamAIIntegrationMutation = createMutation<
    CreateTeamAIIntegrationResponse,
    CreateTeamAIIntegrationInputDTO
>(
    aiIntegrationService.createByProvider,
    async (_data, variables) => {
        await invalidateTeamAIIntegrationsQuery(variables.teamId);
    }
);

export const useUpdateTeamAIIntegrationMutation = createMutation<
    UpdateTeamAIIntegrationResponse,
    UpdateTeamAIIntegrationInputDTO
>(
    aiIntegrationService.updateByProvider,
    async (_data, variables) => {
        await invalidateTeamAIIntegrationsQuery(variables.teamId);
    }
);

export const useDeleteTeamAIIntegrationMutation = createMutation<void, DeleteTeamAIIntegrationInputDTO>(
    aiIntegrationService.deleteByProvider,
    async (_data, variables) => {
        await invalidateTeamAIIntegrationsQuery(variables.teamId);
    }
);
