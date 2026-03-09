import aiIntegrationService from '../../api/services/ai-integration';
import { buildKeys } from '@/shared/infrastructure/query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { DiscoverTeamAIProviderModelsInputDTO, DiscoverTeamAIProviderModelsOutputDTO } from '../../api/dtos/ai-integration/discover-team-ai-provider-models';
import type { ListTeamAIIntegrationsResponse } from '../../api/dtos/ai-integration/get-team-ai-integrations';
import type { ListTeamAIIntegrationModelsResponse } from '../../api/dtos/ai-integration/get-team-ai-integration-models';
import type { CreateTeamAIIntegrationInputDTO, CreateTeamAIIntegrationResponse } from '../../api/dtos/ai-integration/create-team-ai-integration';
import type { UpdateTeamAIIntegrationInputDTO, UpdateTeamAIIntegrationResponse } from '../../api/dtos/ai-integration/update-team-ai-integration';
import type { DeleteTeamAIIntegrationInputDTO } from '../../api/dtos/ai-integration/delete-team-ai-integration';
import queryClient from '@/shared/infrastructure/query/query-client';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

/** Team AI integration query keys. */

const aiIntegrationKeys = buildKeys<{
    aiIntegrations: void;
    teamAIIntegrations: string;
}>('team-ai-integrations');

const aiIntegrationModelKeys = buildKeys<{
    aiIntegrationModels: void;
    teamAIIntegrationModels: string;
}>('team-ai-integration-models');

const aiIntegrationDiscoveryKeys = buildKeys<{
    aiIntegrationModelDiscovery: void;
    discoverAIIntegrationModels: DiscoverTeamAIProviderModelsInputDTO;
}>('team-ai-integration-model-discovery');

export const AI_INTEGRATION_QUERY_KEYS = {
    aiIntegrations: aiIntegrationKeys.aiIntegrations,
    teamAIIntegrations: aiIntegrationKeys.teamAIIntegrations,
    aiIntegrationModels: aiIntegrationModelKeys.aiIntegrationModels,
    teamAIIntegrationModels: aiIntegrationModelKeys.teamAIIntegrationModels,
    aiIntegrationModelDiscovery: aiIntegrationDiscoveryKeys.aiIntegrationModelDiscovery,
    discoverAIIntegrationModels: aiIntegrationDiscoveryKeys.discoverAIIntegrationModels
};

/** Invalidates AI integration queries for a team. */

export const invalidateTeamAIIntegrationsQuery = (teamId: string) => {
    return Promise.all([
        queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrations(teamId) }),
        queryClient.invalidateQueries({ queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrationModels(teamId) })
    ]);
};

/** Team AI integration queries. */

export const useTeamAIIntegrationsQuery = (
    teamId: string,
    options?: QueryOptions<ListTeamAIIntegrationsResponse>
) => {
    return useQuery({
        queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrations(teamId),
        queryFn: () => aiIntegrationService.listByTeamId({ teamId }),
        ...options
    });
};

export const useTeamAIIntegrationModelsQuery = (
    teamId: string,
    options?: QueryOptions<ListTeamAIIntegrationModelsResponse>
) => {
    return useQuery({
        queryKey: AI_INTEGRATION_QUERY_KEYS.teamAIIntegrationModels(teamId),
        queryFn: () => aiIntegrationService.listModels({ teamId }),
        ...options
    });
};

export const useDiscoverTeamAIProviderModelsQuery = (
    params: DiscoverTeamAIProviderModelsInputDTO,
    options?: QueryOptions<DiscoverTeamAIProviderModelsOutputDTO>
) => {
    return useQuery({
        queryKey: AI_INTEGRATION_QUERY_KEYS.discoverAIIntegrationModels(params),
        queryFn: () => aiIntegrationService.discoverModels(params),
        ...options
    });
};

/** Team AI integration mutations. */

export const useCreateTeamAIIntegrationMutation = () => {
    return useMutation<CreateTeamAIIntegrationResponse, Error, CreateTeamAIIntegrationInputDTO>({
        mutationFn: aiIntegrationService.createByProvider,
        onSuccess: (_data, variables) => {
            invalidateTeamAIIntegrationsQuery(variables.teamId);
        }
    });
};

export const useUpdateTeamAIIntegrationMutation = () => {
    return useMutation<UpdateTeamAIIntegrationResponse, Error, UpdateTeamAIIntegrationInputDTO>({
        mutationFn: aiIntegrationService.updateByProvider,
        onSuccess: (_data, variables) => {
            invalidateTeamAIIntegrationsQuery(variables.teamId);
        }
    });
};

export const useDeleteTeamAIIntegrationMutation = () => {
    return useMutation<void, Error, DeleteTeamAIIntegrationInputDTO>({
        mutationFn: aiIntegrationService.deleteByProvider,
        onSuccess: (_data, variables) => {
            invalidateTeamAIIntegrationsQuery(variables.teamId);
        }
    });
};
