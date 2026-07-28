import { createService, paginated, post, patch, del } from '@/app/core/http/utils/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { TeamRole } from '@volt/contracts/modules/team/domain';
import type { TeamScopedParams } from '@/shared/api/request-params';
import type { CreateTeamRoleInput, UpdateTeamRoleInput } from '@volt/contracts/modules/team/http';

export type CreateTeamRoleParams = TeamScopedParams & CreateTeamRoleInput;

export interface DeleteTeamRoleInput {
    teamId: string;
    roleId: string;
}

export interface GetTeamRolesParams {
    page: number;
    limit: number;
}

export type GetTeamRolesInput = { teamId: string } & GetTeamRolesParams;

export type UpdateTeamRoleParams = TeamScopedParams & { roleId: string } & UpdateTeamRoleInput;

const endpoints = {
    getAll: paginated<GetTeamRolesInput, PaginatedResponse<TeamRole>>('/:teamId/roles'),
    create: post<CreateTeamRoleParams, TeamRole>('/:teamId/roles'),
    update: patch<UpdateTeamRoleParams, TeamRole>('/:teamId/roles/:roleId'),
    delete: del<DeleteTeamRoleInput>('/:teamId/roles/:roleId')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
