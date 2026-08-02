import roleService from '../../api/services/role-service';
import { createInvalidatingMutation, createQuery } from '@/shared/query';
import { createTeamScopedPaginatedResource } from '../shared/team-scoped-paginated-resource';
import type { TeamScopedAggregateParams } from '../shared/team-scoped-paginated-resource';
import type { TeamRole } from '@volt/contracts/modules/team/domain';
import type { CreateTeamRoleParams, DeleteTeamRoleInput, UpdateTeamRoleParams } from '../../api/services/role-service';

export const teamRolesResource = createTeamScopedPaginatedResource({
    baseKey: 'team-roles',
    listKeyName: 'roles',
    list: roleService.getAll
});

export const TEAM_ROLE_QUERY_KEYS = teamRolesResource.queryKeys;

export const useAllTeamRolesQuery = createQuery<TeamScopedAggregateParams, TeamRole[]>(
    teamRolesResource.getAggregateQueryKey,
    teamRolesResource.fetchAllPages
);

export const useCreateTeamRoleMutation = createInvalidatingMutation<TeamRole, CreateTeamRoleParams>(
    roleService.create,
    (_data, variables) => [teamRolesResource.getListingQueryKey(variables.teamId)]
);

export const useUpdateTeamRoleMutation = createInvalidatingMutation<TeamRole, UpdateTeamRoleParams>(
    roleService.update,
    (_data, variables) => [teamRolesResource.getListingQueryKey(variables.teamId)]
);

export const useDeleteTeamRoleMutation = createInvalidatingMutation<void, DeleteTeamRoleInput>(
    roleService.delete,
    (_data, variables) => [teamRolesResource.getListingQueryKey(variables.teamId)]
);
