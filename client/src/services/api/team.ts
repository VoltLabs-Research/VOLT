import api from '@/api';
import type { Team } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import type { TeamInvitation } from '@/types/team-invitation';

interface CreateTeamPayload {
    name: string;
    description?: string;
}

interface TeamMember {
    _id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    lastLoginAt?: string;
    createdAt?: string;
    timeSpentLast7Days?: number;
    trajectoriesCount?: number;
    analysesCount?: number;
    joinedAt?: string;
}

interface TeamMembersResponse {
    members: TeamMember[];
    admins: TeamMember[];
    owner: TeamMember;
}

export interface ActivityItem {
    type: 'TRAJECTORY_UPLOAD' | 'TRAJECTORY_DELETION' | 'ANALYSIS_PERFORMED';
    user: string;
    createdAt: string;
    description: string;
}

export interface ActivityData {
    date: string;
    activity: ActivityItem[];
    minutesOnline: number;
}

const teamApi = {
    async getAll(): Promise<Team[]> {
        const response = await api.get<{ status: string; data: Team[] }>('/teams');
        return response.data.data;
    },

    async create(data: CreateTeamPayload): Promise<Team> {
        const response = await api.post<ApiResponse<Team>>('/teams', data);
        return response.data.data;
    },

    async update(id: string, data: Partial<CreateTeamPayload>): Promise<Team> {
        const response = await api.patch<ApiResponse<Team>>(`/teams/${id}`, data);
        return response.data.data;
    },

    async delete(id: string): Promise<void> {
        await api.delete(`/teams/${id}`);
    },

    async getActivity(teamId: string, range: number = 365): Promise<ActivityData[]> {
        const response = await api.get<{ status: string; data: ActivityData[] }>(`/teams/${teamId}/activity?range=${range}`);
        console.log(response);
        return response.data.data;
    },

    async leave(id: string): Promise<void> {
        await api.post(`/teams/${id}/leave`);
    },

    members: {
        async getAll(teamId: string): Promise<TeamMembersResponse> {
            const response = await api.get<{ status: string; data: TeamMembersResponse }>(`/teams/${teamId}/members`);
            return response.data.data;
        },

        async promote(teamId: string, userId: string): Promise<void> {
            await api.patch(`/teams/${teamId}/members/promote`, { userId });
        },

        async demote(teamId: string, userId: string): Promise<void> {
            await api.patch(`/teams/${teamId}/members/demote`, { userId });
        },

        async remove(teamId: string, identifier: { userId?: string; email?: string }): Promise<void> {
            await api.post(`/teams/${teamId}/members/remove`, identifier);
        }
    },

    invitations: {
        async getDetails(token: string): Promise<TeamInvitation> {
            const response = await api.get<{ status: string; data: { invitation: TeamInvitation } }>(`/team-invitations/details/${token}`);
            return response.data.data.invitation;
        },

        async send(teamId: string, email: string, role?: string): Promise<void> {
            await api.post(`/team-invitations/${teamId}/invite`, { email, role });
        },

        async accept(token: string): Promise<void> {
            await api.post(`/team-invitations/accept/${token}`);
        },

        async reject(token: string): Promise<void> {
            await api.post(`/team-invitations/reject/${token}`);
        }
    }
};

export default teamApi;
