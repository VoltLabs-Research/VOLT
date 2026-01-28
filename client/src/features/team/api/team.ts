import type { Team } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import type { TeamInvitation } from '@/types/models';
import type { CreateTeamPayload } from '@/features/team/types';
import VoltClient from '@/api';

const client = new VoltClient('/team');
const invitationClient = new VoltClient('/team/invitations', { useRBAC: true });
// TODO: pending fix
const tempNoRbacClient = new VoltClient('/team/invitations', { useRBAC: false });

const teamApi = {
    async getAll(): Promise<Team[]> {
        const response = await client.request<ApiResponse<Team[]>>('get', '/');
        return response.data.data;
    },

    async create(data: CreateTeamPayload): Promise<Team> {
        const response = await client.request<ApiResponse<Team>>('post', '/', { data });
        return response.data.data;
    },

    async update(id: string, data: Partial<CreateTeamPayload>): Promise<Team> {
        const response = await client.request<ApiResponse<Team>>('patch', `/${id}`, { data });
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await client.request('delete', `/${id}`);
    },

    async leave(id: string): Promise<void> {
        await client.request('post', `/${id}/leave`);
    },

    async canInvite(teamId: string): Promise<boolean> {
        const response = await client.request<ApiResponse<{ canInvite: boolean }>>('get', `/${teamId}/can-invite`);
        return response.data.data.canInvite;
    },

    members: {
        async remove(teamId: string, data: { userId?: string; }): Promise<void> {
            await client.request('post', `/${teamId}/members/remove`, { data });
        }
    },

    invitations: {
        async getDetails(invitationId: string): Promise<TeamInvitation> {
            const response = await tempNoRbacClient.request<{ status: string; data: TeamInvitation }>('get', `/${invitationId}`);
            return response.data.data;
        },

        async getPending(): Promise<TeamInvitation[]> {
            const response = await invitationClient.request<{ status: string; data: { data: TeamInvitation[] } }>('get', '/pending');
            return response.data.data.data;
        },

        async send(email: string, role?: string): Promise<void> {
            await invitationClient.request('post', `/invite`, { data: { email, role } });
        },

        async cancel(invitationId: string): Promise<void> {
            await invitationClient.request('delete', `/${invitationId}`);
        },

        async accept(invitationId: string): Promise<void> {
            await tempNoRbacClient.request('post', `/${invitationId}/accept`);
        },

        async reject(invitationId: string): Promise<void> {
            await tempNoRbacClient.request('post', `/${invitationId}/reject`);
        }
    }
};

export default teamApi;
