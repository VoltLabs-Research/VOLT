import roleService from '../../api/services/role-service';
import { createInvalidatingMutation, createQuery } from '@/shared/infrastructure/query';
import { createTeamScopedPaginatedResource } from '../shared/team-scoped-paginated-resource';
import type { TeamRole } from '../../api/entities/role/team-role';
import type { CreateTeamRoleInputDTO, DeleteTeamRoleInputDTO, UpdateTeamRoleInputDTO } from '../../api/services/role-service';

interface TeamRolesAggregateQueryParams {
    teamId: string;
    limit: number;
}

export const teamRolesResource = createTeamScopedPaginatedResource({
    baseKey: 'team-roles',
    listKeyName: 'roles',
    list: roleService.getAll
});

export const TEAM_ROLE_QUERY_KEYS = teamRolesResource.queryKeys;

const getTeamRolesListingQueryKey = teamRolesResource.getListingQueryKey;

const getAllTeamRolesQueryKey = teamRolesResource.getAggregateQueryKey;

const getAllTeamRoles = teamRolesResource.fetchAllPages;

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
