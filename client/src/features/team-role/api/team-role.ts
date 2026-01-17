import type { TeamRole, TeamRolePayload } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import VoltClient, { getTeamId } from '@/api';

const client = new VoltClient('/team-roles', { useRBAC: false });

const teamRoleApi = {
    async getAll(): Promise<TeamRole[]> {
        const teamId = getTeamId();
        const response = await client.request<ApiResponse<TeamRole[]>>('get', `/${teamId}`);
        return response.data.data;
    },

    async create(data: TeamRolePayload): Promise<TeamRole> {
        const teamId = getTeamId();
        const response = await client.request<ApiResponse<TeamRole>>('post', `/${teamId}`, {
            data: { ...data, teamId }
        });
        return response.data.data;
    },

    async update(roleId: string, data: Partial<TeamRolePayload>): Promise<TeamRole> {
        const teamId = getTeamId();
        const response = await client.request<ApiResponse<TeamRole>>('patch', `/${teamId}/${roleId}`, { data });
        return response.data.data;
    },

    async delete(roleId: string): Promise<void> {
        const teamId = getTeamId();
        await client.request('delete', `/${teamId}/${roleId}`);
    },
};

export default teamRoleApi;
