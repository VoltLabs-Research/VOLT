import { createApiClient } from '@/app/core/http/utilities/create-client';
import type { TeamClusterOption } from '@/modules/container/api/entities/team-cluster-option';

const teamsClient = createApiClient('/teams');

export const teamClusterService = {
    async listByTeamId(teamId: string): Promise<TeamClusterOption[]> {
        const response = await teamsClient.getPaginated<TeamClusterOption>(`/${teamId}/clusters`, {
            page: 1,
            limit: 100
        });

        return response.data || [];
    }
};
