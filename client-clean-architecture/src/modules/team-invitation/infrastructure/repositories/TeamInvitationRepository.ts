import { BaseRepository } from '@/shared/infrastructure/repositories/BaseRepository';
import VoltClient from '@/shared/infrastructure/api';
import type { ITeamInvitationRepository } from '../../domain/repositories';
import type { TeamInvitation } from '../../domain/entities';

export class TeamInvitationRepository extends BaseRepository implements ITeamInvitationRepository {
    private readonly tempNoRbacClient: VoltClient;

    constructor() {
        super('/team/invitations', { useRBAC: true });
        this.tempNoRbacClient = new VoltClient('/team/invitations', { useRBAC: false });
    }

    async getDetails(invitationId: string): Promise<TeamInvitation> {
        const response = await this.tempNoRbacClient.request<{ status: string; data: TeamInvitation }>('get', `/${invitationId}`);
        return response.data.data;
    }

    async getPending(): Promise<TeamInvitation[]> {
        const result = await this.get<{ data: TeamInvitation[] }>('/pending');
        return result.data;
    }

    async send(email: string, role?: string): Promise<void> {
        await this.post('/invite', { email, role });
    }

    async cancel(invitationId: string): Promise<void> {
        await this.delete(`/${invitationId}`);
    }

    async accept(invitationId: string): Promise<void> {
        await this.tempNoRbacClient.request('post', `/${invitationId}/accept`);
    }

    async reject(invitationId: string): Promise<void> {
        await this.tempNoRbacClient.request('post', `/${invitationId}/reject`);
    }
}

export const teamInvitationRepository = new TeamInvitationRepository();
