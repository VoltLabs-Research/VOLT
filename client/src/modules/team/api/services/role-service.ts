import { createService, paginated, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { TeamRole } from '@/modules/team/api/entities/role/team-role';

export interface CreateTeamRoleInputDTO {
    teamId: string;
    name: string;
    permissions: string[];
}

export interface DeleteTeamRoleInputDTO {
    teamId: string;
    roleId: string;
}

export interface GetTeamRolesParams {
    page: number;
    limit: number;
}

export type GetTeamRolesInputDTO = { teamId: string } & GetTeamRolesParams;

export interface UpdateTeamRoleInputDTO {
    teamId: string;
    roleId: string;
    name?: string;
    permissions?: string[];
}

const endpoints = {
    getAll: paginated<GetTeamRolesInputDTO, PaginatedResponse<TeamRole>>('/:teamId/roles'),
    create: post<CreateTeamRoleInputDTO, TeamRole>('/:teamId/roles'),
    update: patch<UpdateTeamRoleInputDTO, TeamRole>('/:teamId/roles/:roleId'),
    delete: del<DeleteTeamRoleInputDTO>('/:teamId/roles/:roleId')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
