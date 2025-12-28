import type { TeamRole, TeamRolePayload } from '@/types/team-role';
import type { ApiResponse } from '@/types/api';
import VoltClient from '@/api';

const client = new VoltClient('/team-roles', { useRBAC: true });

const teamRoleApi = {
    async getAll(): Promise<TeamRole[]> {
        const response = await client.request<ApiResponse<TeamRole[]>>('get', '/');
        return response.data.data;
    },

    async create(data: TeamRolePayload): Promise<TeamRole> {
        const response = await client.request<ApiResponse<TeamRole>>('post', '/', { data });
        return response.data.data;
    },

    async update(roleId: string, data: Partial<TeamRolePayload>): Promise<TeamRole> {
        const response = await client.request<ApiResponse<TeamRole>>('patch', `/${roleId}`, { data });
        return response.data.data;
    },

    async delete(roleId: string): Promise<void> {
        await client.request('delete', `/${roleId}`);
    },
};

export default teamRoleApi;
