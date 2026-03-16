import { createApiClient } from '@/app/core/http/utilities/create-client';
import type { ClusterResourceLimits } from '@/modules/container/api/entities/cluster-resource-limits';
import type { TeamClusterOption } from '@/modules/container/api/entities/team-cluster-option';

const teamsClient = createApiClient('/teams');

interface ApiResponse<T> {
    status: string;
    data: T;
};

interface GetClusterResourceLimitsResponse {
    resourceLimits: ClusterResourceLimits;
};

export const teamClusterService = {
    async listByTeamId(teamId: string): Promise<TeamClusterOption[]> {
        const response = await teamsClient.getPaginated<TeamClusterOption>(`/${teamId}/clusters`, {
            page: 1,
            limit: 100
        });

        return response.data || [];
    },
    async getResourceLimits(teamId: string, teamClusterId: string): Promise<ClusterResourceLimits> {
        const response = await teamsClient.get<ApiResponse<GetClusterResourceLimitsResponse>>(
            `/${teamId}/clusters/${teamClusterId}/resource-limits`
        );

        return response.data.resourceLimits;
    }
};
