import roleService from '../../api/services/role';
import { createInvalidatingMutation, createQueryResource } from '@/shared/api/query-resources';
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

const teamRolesResource = createQueryResource<TeamRolesQueryParams, string, PaginatedResponse<TeamRole>>({
    baseKey: 'team-roles',
    rootKey: 'roles',
    itemKey: 'rolesListing',
    getKeyParam: ({ teamId }) => teamId,
    query: roleService.getAll
});

export const TEAM_ROLE_QUERY_KEYS = {
    roles: teamRolesResource.keys.root,
    rolesListing: teamRolesResource.keys.item
};

const invalidateTeamRolesQuery = teamRolesResource.invalidate;

export const useTeamRolesQuery = teamRolesResource.query;

export const buildTeamRolesQueryOptions = teamRolesResource.query.buildOptions;

export const fetchTeamRoles = teamRolesResource.query.fetch;

export const useCreateTeamRoleMutation = createInvalidatingMutation<TeamRole, CreateTeamRoleInputDTO>({
    mutationFn: roleService.create,
    onSuccess: (_data, variables) => {
        void invalidateTeamRolesQuery(variables.teamId);
    }
});

export const useUpdateTeamRoleMutation = createInvalidatingMutation<TeamRole, UpdateTeamRoleInputDTO>({
    mutationFn: roleService.update,
    onSuccess: (_data, variables) => {
        void invalidateTeamRolesQuery(variables.teamId);
    }
});

export const useDeleteTeamRoleMutation = createInvalidatingMutation<void, DeleteTeamRoleInputDTO>({
    mutationFn: roleService.delete,
    onSuccess: (_data, variables) => {
        void invalidateTeamRolesQuery(variables.teamId);
    }
});
