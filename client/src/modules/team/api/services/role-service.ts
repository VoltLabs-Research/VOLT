import { createService, paginated, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamRole } from '@/modules/team/api/entities/role/team-role';
import type { GetTeamRolesInputDTO } from '../dtos/role/get-team-roles';
import type { CreateTeamRoleInputDTO } from '../dtos/role/create-team-role';
import type { DeleteTeamRoleInputDTO } from '../dtos/role/delete-team-role';
import type { UpdateTeamRoleInputDTO } from '../dtos/role/update-team-role';

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
