import { paginated, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamRole } from '@/modules/team/api/entities/team-role';
import type { GetTeamRolesInputDTO } from '../../../dtos/get-team-roles';
import type { CreateTeamRoleInputDTO } from '../../../dtos/create-team-role';
import type { UpdateTeamRoleInputDTO } from '../../../dtos/update-team-role';

const endpoints = {
    getAll: paginated<GetTeamRolesInputDTO, PaginatedResponse<TeamRole>>('/:teamId/roles'),
    create: post<CreateTeamRoleInputDTO, TeamRole>('/:teamId/roles'),
    update: patch<UpdateTeamRoleInputDTO, TeamRole>('/:teamId/roles/:roleId'),
    delete: del<{ teamId: string; roleId: string }>('/:teamId/roles/:roleId')
};

export default endpoints;
