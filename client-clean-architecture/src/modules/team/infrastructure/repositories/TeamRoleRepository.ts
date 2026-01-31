import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import ITeamRoleRepository, { CreateTeamRoleParams, UpdateTeamRoleParams } from '../../domain/ports/ITeamRoleRepository';
import { TeamRole } from '../../domain/entities';

@injectable()
export default class TeamRoleRepository extends BaseRepository implements ITeamRoleRepository{
    constructor(){
        super('/team/roles', { useRBAC: false });
    }

    async getAll(teamId: string): Promise<TeamRole[]>{
        const response = await this.client.get<ApiResponse<TeamRole[]>>(`/${teamId}`);
        return this.unwrap(response);
    }

    async create(teamId: string, data: CreateTeamRoleParams): Promise<TeamRole>{
        const response = await this.client.post<ApiResponse<TeamRole>>(`/${teamId}`, {
            ...data,
            teamId
        });
        return this.unwrap(response);
    }

    async update(teamId: string, roleId: string, data: UpdateTeamRoleParams): Promise<TeamRole>{
        const response = await this.client.patch<ApiResponse<TeamRole>>(`/${teamId}/${roleId}`, data);
        return this.unwrap(response);
    }

    async delete(teamId: string, roleId: string): Promise<void>{
        await this.client.delete(`/${teamId}/${roleId}`);
    }
};
