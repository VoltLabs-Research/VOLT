import { injectable } from 'tsyringe';
import BaseRepository, { ApiResponse, RawPaginatedResponse } from '@/shared/infrastructure/repositories/BaseRepository';
import type ITeamRoleRepository from '../../domain/ports/ITeamRoleRepository';
import type { GetTeamRolesParams, CreateTeamRoleParams, UpdateTeamRoleParams } from '../../domain/ports/ITeamRoleRepository';
import type { TeamRole } from '../../domain/entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

@injectable()
export default class TeamRoleRepository extends BaseRepository implements ITeamRoleRepository {
    constructor() {
        super('/team/roles', { useRBAC: false });
    }

    async getAll(teamId: string, params: GetTeamRolesParams): Promise<PaginatedResponse<TeamRole>> {
        const raw = await this.client.get<RawPaginatedResponse<TeamRole>>(`/${teamId}`, params);
        return this.unwrapPaginated(raw);
    }

    async create(teamId: string, data: CreateTeamRoleParams): Promise<TeamRole> {
        const response = await this.client.post<ApiResponse<TeamRole>>(`/${teamId}`, {
            ...data,
            teamId
        });
        return this.unwrap(response);
    }

    async update(teamId: string, roleId: string, data: UpdateTeamRoleParams): Promise<TeamRole> {
        const response = await this.client.patch<ApiResponse<TeamRole>>(`/${teamId}/${roleId}`, data);
        return this.unwrap(response);
    }

    async delete(teamId: string, roleId: string): Promise<void> {
        await this.client.delete(`/${teamId}/${roleId}`);
    }
};
