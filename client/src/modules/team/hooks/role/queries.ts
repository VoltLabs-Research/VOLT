import roleService from '../../api/services/role';
import { createInvalidatingMutation, createQuery } from '@/shared/infrastructure/query';
import { createTeamScopedPaginatedResource } from '../shared/team-scoped-paginated-resource';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamRole } from '../../api/entities/role/team-role';
import type { CreateTeamRoleInputDTO } from '../../api/dtos/role/create-team-role';
import type { UpdateTeamRoleInputDTO } from '../../api/dtos/role/update-team-role';
import type { DeleteTeamRoleInputDTO } from '../../api/dtos/role/delete-team-role';

interface TeamRolesQueryParams {
    teamId: string;
    page: number;
    limit: number;
};

interface TeamRolesAggregateQueryParams {
    teamId: string;
    limit: number;
};

export const teamRolesResource = createTeamScopedPaginatedResource({
    baseKey: 'team-roles',
    listKeyName: 'roles',
    list: roleService.getAll
});

export const TEAM_ROLE_QUERY_KEYS = teamRolesResource.queryKeys;

export const getTeamRolesListingQueryKey = teamRolesResource.getListingQueryKey;

const getTeamRolesQueryKey = teamRolesResource.getPageQueryKey;

const getAllTeamRolesQueryKey = teamRolesResource.getAggregateQueryKey;

const getAllTeamRoles = teamRolesResource.fetchAllPages;

export const useTeamRolesQuery = createQuery<TeamRolesQueryParams, PaginatedResponse<TeamRole>>(
    getTeamRolesQueryKey,
    roleService.getAll
);

export const useAllTeamRolesQuery = createQuery<TeamRolesAggregateQueryParams, TeamRole[]>(
    getAllTeamRolesQueryKey,
    getAllTeamRoles
);

export const useCreateTeamRoleMutation = createInvalidatingMutation<TeamRole, CreateTeamRoleInputDTO>(
    roleService.create,
    (_data, variables) => [getTeamRolesListingQueryKey({ teamId: variables.teamId })]
);

export const useUpdateTeamRoleMutation = createInvalidatingMutation<TeamRole, UpdateTeamRoleInputDTO>(
    roleService.update,
    (_data, variables) => [getTeamRolesListingQueryKey({ teamId: variables.teamId })]
);

export const useDeleteTeamRoleMutation = createInvalidatingMutation<void, DeleteTeamRoleInputDTO>(
    roleService.delete,
    (_data, variables) => [getTeamRolesListingQueryKey({ teamId: variables.teamId })]
);
