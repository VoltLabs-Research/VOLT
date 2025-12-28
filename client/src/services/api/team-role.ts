import api from '@/api';
import type { TeamRole, TeamRolePayload, TeamMemberWithRole } from '@/types/team-role';
import type { ApiResponse } from '@/types/api';

const teamRoleApi = {
    async getAll(teamId: string): Promise<TeamRole[]> {
        const response = await api.get<ApiResponse<TeamRole[]>>(`/teams/${teamId}/roles`);
        return response.data.data;
    },

    async create(teamId: string, data: TeamRolePayload): Promise<TeamRole> {
        const response = await api.post<ApiResponse<TeamRole>>(`/teams/${teamId}/roles`, data);
        return response.data.data;
    },

    async update(teamId: string, roleId: string, data: Partial<TeamRolePayload>): Promise<TeamRole> {
        const response = await api.patch<ApiResponse<TeamRole>>(`/teams/${teamId}/roles/${roleId}`, data);
        return response.data.data;
    },

    async delete(teamId: string, roleId: string): Promise<void> {
        await api.delete(`/teams/${teamId}/roles/${roleId}`);
    },

    async getMembers(teamId: string): Promise<TeamMemberWithRole[]> {
        const response = await api.get<ApiResponse<TeamMemberWithRole[]>>(`/teams/${teamId}/roles/members`);
        return response.data.data;
    },

    async assignRole(teamId: string, memberId: string, roleId: string): Promise<TeamMemberWithRole> {
        const response = await api.patch<ApiResponse<TeamMemberWithRole>>(
            `/teams/${teamId}/roles/members/${memberId}/role`,
            { roleId }
        );
        return response.data.data;
    }
};

export default teamRoleApi;
