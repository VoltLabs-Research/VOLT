import { createService, paginated, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { TeamRole } from '@/modules/team/api/types/role/team-role';

export interface CreateTeamRoleInput {
    teamId: string;
    name: string;
    permissions: string[];
}

export interface DeleteTeamRoleInput {
    teamId: string;
    roleId: string;
}

export interface GetTeamRolesParams {
    page: number;
    limit: number;
}

export type GetTeamRolesInput = { teamId: string } & GetTeamRolesParams;

export interface UpdateTeamRoleInput {
    teamId: string;
    roleId: string;
    name?: string;
    permissions?: string[];
}

const endpoints = {
    getAll: paginated<GetTeamRolesInput, PaginatedResponse<TeamRole>>('/:teamId/roles'),
    create: post<CreateTeamRoleInput, TeamRole>('/:teamId/roles'),
    update: patch<UpdateTeamRoleInput, TeamRole>('/:teamId/roles/:roleId'),
    delete: del<DeleteTeamRoleInput>('/:teamId/roles/:roleId')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
