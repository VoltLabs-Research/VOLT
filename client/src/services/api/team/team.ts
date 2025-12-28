import type { Team } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import type { TeamInvitation } from '@/types/team-invitation';
import type { CreateTeamPayload } from './types';
import VoltClient from '@/api';

const client = new VoltClient('/teams');

const teamApi = {
    async getAll(): Promise<Team[]> {
        const response = await client.request<{ status: string; data: Team[] }>('get', '/');
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
        async remove(teamId: string, identifier: { userId?: string; email?: string }): Promise<void> {
            await client.request('post', `/${teamId}/members/remove`, { data: { identifier } });
        }
    },

    invitations: {
        async getDetails(token: string): Promise<TeamInvitation> {
            const response = await client.request<{ status: string; data: { invitation: TeamInvitation } }>('get', `/team-invitations/details/${token}`);
            return response.data.data.invitation;
        },

        async send(teamId: string, email: string, role?: string): Promise<void> {
            await client.request('post', `/team-invitations/${teamId}/invite`, { data: { email, role } });
        },

        async accept(token: string): Promise<void> {
            await client.request('post', `/team-invitations/accept/${token}`);
        },

        async reject(token: string): Promise<void> {
            await client.request('post', `/team-invitations/reject/${token}`);
        }
    }
};

export default teamApi;
