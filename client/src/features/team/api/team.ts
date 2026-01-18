import type { Team } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import type { TeamInvitation } from '@/types/models';
import type { CreateTeamPayload } from '@/features/team/types';
import VoltClient from '@/api';

const client = new VoltClient('/team');
const invitationClient = new VoltClient('/team/invititations', { useRBAC: true });

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

    members: {
        async remove(teamId: string, data: { userId?: string; }): Promise<void> {
            await client.request('post', `/${teamId}/members/remove`, { data });
        }
    },

    invitations: {
        async getDetails(token: string): Promise<TeamInvitation> {
            const response = await invitationClient.request<{ status: string; data: TeamInvitation }>('get', `/details/${token}`);
            return response.data.data;
        },

        async getPending(): Promise<TeamInvitation[]> {
            const response = await invitationClient.request<{ status: string; data: { data: TeamInvitation[] } }>('get', '/pending');
            // Backend returns paginated result: { status, data: { data: TeamInvitation[], page, limit, total } }
            return response.data.data.data;
        },

        async send(email: string, role?: string): Promise<void> {
            await invitationClient.request('post', `/invite`, { data: { email, role } });
        },

        async cancel(invitationId: string): Promise<void> {
            await invitationClient.request('delete', `/cancel/${invitationId}`);
        },

        async accept(token: string): Promise<void> {
            await invitationClient.request('post', `/accept/${token}`);
        },

        async reject(token: string): Promise<void> {
            await invitationClient.request('post', `/reject/${token}`);
        }
    }
};

export default teamApi;
