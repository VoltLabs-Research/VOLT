import type { TeamRole } from '../entities';
import type { PaginatedResponse } from '@/shared/domain/pagination';

export interface GetTeamRolesParams {
    page: number;
    limit: number;
};

export interface CreateTeamRoleParams {
    name: string;
    permissions: string[];
};

export interface UpdateTeamRoleParams {
    name?: string;
    permissions?: string[];
};

export default interface ITeamRoleRepository {
    getAll(teamId: string, params: GetTeamRolesParams): Promise<PaginatedResponse<TeamRole>>;
    create(teamId: string, data: CreateTeamRoleParams): Promise<TeamRole>;
    update(teamId: string, roleId: string, data: UpdateTeamRoleParams): Promise<TeamRole>;
    delete(teamId: string, roleId: string): Promise<void>;
};
