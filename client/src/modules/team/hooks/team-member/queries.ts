import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import queryClient from '@/shared/infrastructure/query/query-client';
import { buildKeys } from '@/shared/infrastructure/query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamMember } from '../../api/entities/team-member';
import type { UpdateTeamMemberInputDTO } from '../../api/dtos/update-team-member';
import type { RemoveTeamMemberInputDTO } from '../../api/dtos/remove-team-member';
import memberService from '../../api/services/member';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const memberKeys = buildKeys<{
    members: void;
    membersListing: string;
}>('team-members');

export const TEAM_MEMBER_QUERY_KEYS = {
    members: memberKeys.members,
    membersListing: memberKeys.membersListing
};

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const invalidateTeamMembersQuery = (teamId: string) => {
    return queryClient.invalidateQueries({ queryKey: TEAM_MEMBER_QUERY_KEYS.membersListing(teamId) });
};

// ---------------------------------------------------------------------------
// Query param interfaces
// ---------------------------------------------------------------------------

interface TeamMembersQueryParams {
    teamId: string;
    page: number;
    limit: number;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export const useTeamMembersQuery = (
    params: TeamMembersQueryParams,
    options?: QueryOptions<PaginatedResponse<TeamMember>>
) => {
    return useQuery({
        queryKey: TEAM_MEMBER_QUERY_KEYS.membersListing(params.teamId),
        queryFn: () => memberService.getAll({ teamId: params.teamId, page: params.page, limit: params.limit }),
        ...options
    });
};

export const buildTeamMembersQueryOptions = (params: TeamMembersQueryParams) => ({
    queryKey: TEAM_MEMBER_QUERY_KEYS.membersListing(params.teamId),
    queryFn: () => memberService.getAll({ teamId: params.teamId, page: params.page, limit: params.limit })
});

export const fetchTeamMembers = (params: TeamMembersQueryParams) => {
    return queryClient.fetchQuery(buildTeamMembersQueryOptions(params));
};

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export const useUpdateTeamMemberMutation = () => {
    return useMutation<TeamMember, Error, UpdateTeamMemberInputDTO>({
        mutationFn: memberService.update,
        onSuccess: (_data, variables) => {
            void invalidateTeamMembersQuery(variables.teamId);
        }
    });
};

export const useRemoveTeamMemberMutation = () => {
    return useMutation<void, Error, RemoveTeamMemberInputDTO>({
        mutationFn: memberService.remove,
        onSuccess: (_data, variables) => {
            void invalidateTeamMembersQuery(variables.teamId);
        }
    });
};
