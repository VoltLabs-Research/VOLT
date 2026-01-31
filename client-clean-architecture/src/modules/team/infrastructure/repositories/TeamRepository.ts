import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import ITeamRepository, { CreateTeamParams, UpdateTeamParams } from '../../domain/ports/ITeamRepository';
import { Team } from '../../domain/entities';

@injectable()
export default class TeamRepository extends BaseRepository implements ITeamRepository{
    constructor(){
        super('/team', { useRBAC: false });
    }

    async getAll(): Promise<Team[]>{
        const response = await this.client.get<ApiResponse<Team[]>>('/');
        return this.unwrap(response);
    }

    async create(data: CreateTeamParams): Promise<Team>{
        const response = await this.client.post<ApiResponse<Team>>('/', data);
        return this.unwrap(response);
    }

    async update(id: string, data: UpdateTeamParams): Promise<Team>{
        const response = await this.client.patch<ApiResponse<Team>>(`/${id}`, data);
        return this.unwrap(response);
    }

    async delete(id: string): Promise<void>{
        await this.client.delete(`/${id}`);
    }

    async leave(id: string): Promise<void>{
        await this.client.post(`/${id}/leave`);
    }

    async canInvite(teamId: string): Promise<boolean>{
        const response = await this.client.get<ApiResponse<{ canInvite: boolean }>>(`/${teamId}/can-invite`);
        return this.unwrap(response).canInvite;
    }
};
