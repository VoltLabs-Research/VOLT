import { createService, paginated, serviceRoutes } from '@/app/core/http/utils/create-service';
import { teamRoleRoutes } from '@volt/contracts/modules/team/routes';

import type { PaginatedResponse } from '@voltstack/voltclient';
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

type GetTeamRolesInput = { teamId: string } & GetTeamRolesParams;

export type UpdateTeamRoleParams = TeamScopedParams & { roleId: string } & UpdateTeamRoleInput;

const routes = serviceRoutes('/teams');

const endpoints = {
    getAll: paginated<GetTeamRolesInput, PaginatedResponse<TeamRole>>(routes.path(teamRoleRoutes.list)),
    create: routes.route<CreateTeamRoleParams, TeamRole>(teamRoleRoutes.create),
    update: routes.route<UpdateTeamRoleParams, TeamRole>(teamRoleRoutes.update),
    delete: routes.route<DeleteTeamRoleInput, void>(teamRoleRoutes.remove, { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
