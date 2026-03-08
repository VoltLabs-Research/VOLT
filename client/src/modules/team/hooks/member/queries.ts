import memberService from '../../api/services/member';
import { buildKeys } from '@/shared/infrastructure/query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamMember, TeamMemberStats } from '../../api/entities/member/team-member';
import type { UpdateTeamMemberInputDTO } from '../../api/dtos/member/update-team-member';
import type { RemoveTeamMemberInputDTO } from '../../api/dtos/member/remove-team-member';
import queryClient from '@/shared/infrastructure/query/query-client';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

interface TeamMembersQueryParams {
    teamId: string;
    page: number;
    limit: number;
};

/** Team member query keys. */

const memberKeys = buildKeys<{
    members: void;
    membersListing: string;
}>('team-members');

export const TEAM_MEMBER_QUERY_KEYS = {
    members: memberKeys.members,
    membersListing: memberKeys.membersListing
};

/** Team member cache helpers. */

const invalidateTeamMembersQuery = (teamId: string) => {
    return queryClient.invalidateQueries({ queryKey: TEAM_MEMBER_QUERY_KEYS.membersListing(teamId) });
};

/** Team member queries. */

export const useTeamMembersQuery = (
    params: TeamMembersQueryParams,
    options?: QueryOptions<PaginatedResponse<TeamMemberStats>>
) => {
    return useQuery({
        queryKey: TEAM_MEMBER_QUERY_KEYS.membersListing(params.teamId),
        queryFn: () => memberService.getAll({
            teamId: params.teamId,
            page: params.page,
            limit: params.limit
        }),
        ...options
    });
};

export const buildTeamMembersQueryOptions = (params: TeamMembersQueryParams) => ({
    queryKey: TEAM_MEMBER_QUERY_KEYS.membersListing(params.teamId),
    queryFn: () => memberService.getAll({
        teamId: params.teamId,
        page: params.page,
        limit: params.limit
    })
});

export const fetchTeamMembers = (params: TeamMembersQueryParams) => {
    return queryClient.fetchQuery(buildTeamMembersQueryOptions(params));
};

/** Team member mutations. */

export const useUpdateTeamMemberMutation = () => {
    return useMutation<TeamMember, Error, UpdateTeamMemberInputDTO>({
        mutationFn: memberService.update,
        onSuccess: (_data, variables) => {
            invalidateTeamMembersQuery(variables.teamId);
        }
    });
};

export const useRemoveTeamMemberMutation = () => {
    return useMutation<void, Error, RemoveTeamMemberInputDTO>({
        mutationFn: memberService.remove,
        onSuccess: (_data, variables) => {
            invalidateTeamMembersQuery(variables.teamId);
        }
    });
};
