import memberService from '../../api/services/member-service';
import { createInvalidatingMutation, createQuery } from '@/shared/query';
import { createTeamScopedPaginatedResource } from '../shared/team-scoped-paginated-resource';
import type { TeamMember, TeamMemberStats } from '../../api/types/member/team-member';
import type { RemoveTeamMemberInput, UpdateTeamMemberInput } from '../../api/services/member-service';

interface TeamMembersAggregateQueryParams {
    teamId: string;
    limit: number;
}

export const teamMembersResource = createTeamScopedPaginatedResource({
    baseKey: 'team-members',
    listKeyName: 'members',
    list: memberService.getAll
});

export const TEAM_MEMBER_QUERY_KEYS = teamMembersResource.queryKeys;

const getTeamMembersListingQueryKey = teamMembersResource.getListingQueryKey;

const getAllTeamMembersQueryKey = teamMembersResource.getAggregateQueryKey;

const getAllTeamMembers = teamMembersResource.fetchAllPages;

export const useAllTeamMembersQuery = createQuery<TeamMembersAggregateQueryParams, TeamMemberStats[]>(
    getAllTeamMembersQueryKey,
    getAllTeamMembers
);

export const useUpdateTeamMemberMutation = createInvalidatingMutation<TeamMember, UpdateTeamMemberInput>(
    memberService.update,
    (_data, variables) => [getTeamMembersListingQueryKey({ teamId: variables.teamId })]
);

export const useRemoveTeamMemberMutation = createInvalidatingMutation<void, RemoveTeamMemberInput>(
    memberService.remove,
    (_data, variables) => [getTeamMembersListingQueryKey({ teamId: variables.teamId })]
);
