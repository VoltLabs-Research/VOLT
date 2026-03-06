import { injectable, inject } from 'tsyringe';
import VoltClient from '@/app/core/http/VoltClient';
import { http } from '@/app/di';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import ITeamInvitationRepository from '../../domain/port/ITeamInvitationRepository';
import ITeamStorage from '../../domain/port/ITeamStorage';
import { TeamInvitation } from '../../domain/entities';
import { TEAM_TOKENS } from '../di/tokens';

@injectable()
export default class TeamInvitationRepository extends BaseRepository implements ITeamInvitationRepository{
    private readonly rbacClient: VoltClient;

    constructor(
        @inject(TEAM_TOKENS.TeamStorage)
        private readonly teamStorage: ITeamStorage
    ){
        super('/team/invitations', { useRBAC: false });
        this.rbacClient = new VoltClient(http, '/team/invitations', {
            useRBAC: true,
            getTeamId: () => this.teamStorage.getSelectedTeamId()
        });
    }

    async getDetails(invitationId: string): Promise<TeamInvitation>{
        const response = await this.client.get<ApiResponse<TeamInvitation>>(`/${invitationId}`);
        return this.unwrap(response);
    }

    async getPending(): Promise<TeamInvitation[]>{
        const response = await this.rbacClient.get<ApiResponse<PaginatedResponse<TeamInvitation>>>('/pending');
        return response.data.data;
    }

    async send(email: string, role?: string): Promise<void>{
        await this.rbacClient.post('/invite', { email, role });
    }

    async cancel(invitationId: string): Promise<void>{
        await this.rbacClient.delete(`/${invitationId}`);
    }

    async accept(invitationId: string): Promise<void>{
        await this.client.post(`/${invitationId}/accept`);
    }

    async reject(invitationId: string): Promise<void>{
        await this.client.post(`/${invitationId}/reject`);
    }
};
