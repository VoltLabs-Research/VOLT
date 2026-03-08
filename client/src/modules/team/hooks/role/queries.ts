import roleService from '../../api/services/role';
import { buildKeys } from '@/shared/infrastructure/query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamRole } from '../../api/entities/role/team-role';
import type { CreateTeamRoleInputDTO } from '../../api/dtos/role/create-team-role';
import type { UpdateTeamRoleInputDTO } from '../../api/dtos/role/update-team-role';
import type { DeleteTeamRoleInputDTO } from '../../api/dtos/role/delete-team-role';
import queryClient from '@/shared/infrastructure/query/query-client';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

interface TeamRolesQueryParams {
    teamId: string;
    page: number;
    limit: number;
};

/** Team role query keys. */

const roleKeys = buildKeys<{
    roles: void;
    rolesListing: string;
}>('team-roles');

export const TEAM_ROLE_QUERY_KEYS = {
    roles: roleKeys.roles,
    rolesListing: roleKeys.rolesListing
};

/** Team role cache helpers. */

const invalidateTeamRolesQuery = (teamId: string) => {
    return queryClient.invalidateQueries({ queryKey: TEAM_ROLE_QUERY_KEYS.rolesListing(teamId) });
};

/** Team role queries. */

export const useTeamRolesQuery = (
    params: TeamRolesQueryParams,
    options?: QueryOptions<PaginatedResponse<TeamRole>>
) => {
    return useQuery({
        queryKey: TEAM_ROLE_QUERY_KEYS.rolesListing(params.teamId),
        queryFn: () => roleService.getAll({
            teamId: params.teamId,
            page: params.page,
            limit: params.limit
        }),
        ...options
    });
};

export const buildTeamRolesQueryOptions = (params: TeamRolesQueryParams) => ({
    queryKey: TEAM_ROLE_QUERY_KEYS.rolesListing(params.teamId),
    queryFn: () => roleService.getAll({
        teamId: params.teamId,
        page: params.page,
        limit: params.limit
    })
});

export const fetchTeamRoles = (params: TeamRolesQueryParams) => {
    return queryClient.fetchQuery(buildTeamRolesQueryOptions(params));
};

/** Team role mutations. */

export const useCreateTeamRoleMutation = () => {
    return useMutation<TeamRole, Error, CreateTeamRoleInputDTO>({
        mutationFn: roleService.create,
        onSuccess: (_data, variables) => {
            invalidateTeamRolesQuery(variables.teamId);
        }
    });
};

export const useUpdateTeamRoleMutation = () => {
    return useMutation<TeamRole, Error, UpdateTeamRoleInputDTO>({
        mutationFn: roleService.update,
        onSuccess: (_data, variables) => {
            invalidateTeamRolesQuery(variables.teamId);
        }
    });
};

export const useDeleteTeamRoleMutation = () => {
    return useMutation<void, Error, DeleteTeamRoleInputDTO>({
        mutationFn: roleService.delete,
        onSuccess: (_data, variables) => {
            invalidateTeamRolesQuery(variables.teamId);
        }
    });
};
