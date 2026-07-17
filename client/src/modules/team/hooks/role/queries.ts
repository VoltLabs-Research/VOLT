import roleService from '../../api/services/role-service';
import { createInvalidatingMutation, createQuery } from '@/shared/query';
import { createTeamScopedPaginatedResource } from '../shared/team-scoped-paginated-resource';
import type { TeamRole } from '../../api/types/role/team-role';
import type { CreateTeamRoleInput, DeleteTeamRoleInput, UpdateTeamRoleInput } from '../../api/services/role-service';

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

export const useCreateTeamRoleMutation = createInvalidatingMutation<TeamRole, CreateTeamRoleInput>(
    roleService.create,
    (_data, variables) => [getTeamRolesListingQueryKey({ teamId: variables.teamId })]
);

export const useUpdateTeamRoleMutation = createInvalidatingMutation<TeamRole, UpdateTeamRoleInput>(
    roleService.update,
    (_data, variables) => [getTeamRolesListingQueryKey({ teamId: variables.teamId })]
);

export const useDeleteTeamRoleMutation = createInvalidatingMutation<void, DeleteTeamRoleInput>(
    roleService.delete,
    (_data, variables) => [getTeamRolesListingQueryKey({ teamId: variables.teamId })]
);
