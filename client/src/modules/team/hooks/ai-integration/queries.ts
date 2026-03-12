import aiIntegrationService from '../../api/services/ai-integration';
import { createInvalidatingMutation, createQueryResource } from '@/shared/api/query-resources';
import type { ListTeamAIIntegrationsResponse } from '../../api/dtos/ai-integration/get-team-ai-integrations';
import type { ListTeamAIIntegrationModelsResponse } from '../../api/dtos/ai-integration/get-team-ai-integration-models';
import type { CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationResponse } from '../../api/dtos/ai-integration/create-team-ai-integration';
import type { UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationResponse } from '../../api/dtos/ai-integration/update-team-ai-integration';
import type { DeleteTeamAIIntegrationInputDTO } from '../../api/dtos/ai-integration/delete-team-ai-integration';

const teamAIIntegrationsResource = createQueryResource<string, string, ListTeamAIIntegrationsResponse>({
    baseKey: 'team-ai-integrations',
    rootKey: 'aiIntegrations',
    itemKey: 'teamAIIntegrations',
    getKeyParam: (teamId) => teamId,
    query: (teamId) => aiIntegrationService.listByTeamId({ teamId })
});

const teamAIIntegrationModelsResource = createQueryResource<string, string, ListTeamAIIntegrationModelsResponse>({
    baseKey: 'team-ai-integration-models',
    rootKey: 'aiIntegrationModels',
    itemKey: 'teamAIIntegrationModels',
    getKeyParam: (teamId) => teamId,
    query: (teamId) => aiIntegrationService.listModels({ teamId })
});

export const AI_INTEGRATION_QUERY_KEYS = {
    aiIntegrations: teamAIIntegrationsResource.keys.root,
    teamAIIntegrations: teamAIIntegrationsResource.keys.item,
    aiIntegrationModels: teamAIIntegrationModelsResource.keys.root,
    teamAIIntegrationModels: teamAIIntegrationModelsResource.keys.item
};

export const invalidateTeamAIIntegrationsQuery = (teamId: string) => {
    return Promise.all([
        teamAIIntegrationsResource.invalidate(teamId),
        teamAIIntegrationModelsResource.invalidate(teamId)
    ]);
};

export const useTeamAIIntegrationsQuery = teamAIIntegrationsResource.query;

export const useTeamAIIntegrationModelsQuery = teamAIIntegrationModelsResource.query;

export const useCreateTeamAIIntegrationMutation = createInvalidatingMutation<
    CreateTeamAIIntegrationResponse,
    CreateTeamAIIntegrationInputDTO
>({
    mutationFn: aiIntegrationService.createByProvider,
    onSuccess: (_data, variables) => {
        void invalidateTeamAIIntegrationsQuery(variables.teamId);
    }
});

export const useUpdateTeamAIIntegrationMutation = createInvalidatingMutation<
    UpdateTeamAIIntegrationResponse,
    UpdateTeamAIIntegrationInputDTO
>({
    mutationFn: aiIntegrationService.updateByProvider,
    onSuccess: (_data, variables) => {
        void invalidateTeamAIIntegrationsQuery(variables.teamId);
    }
});

export const useDeleteTeamAIIntegrationMutation = createInvalidatingMutation<void, DeleteTeamAIIntegrationInputDTO>({
    mutationFn: aiIntegrationService.deleteByProvider,
    onSuccess: (_data, variables) => {
        void invalidateTeamAIIntegrationsQuery(variables.teamId);
    }
});
