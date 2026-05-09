import memberService from '../../api/services/member-service';
import { createInvalidatingMutation, createQuery } from '@/shared/infrastructure/query';
import { createTeamScopedPaginatedResource } from '../shared/team-scoped-paginated-resource';
import type { TeamMember, TeamMemberStats } from '../../api/entities/member/team-member';
import type { RemoveTeamMemberInputDTO, UpdateTeamMemberInputDTO } from '../../api/services/member-service';

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

export const useUpdateTeamMemberMutation = createInvalidatingMutation<TeamMember, UpdateTeamMemberInputDTO>(
    memberService.update,
    (_data, variables) => [getTeamMembersListingQueryKey({ teamId: variables.teamId })]
);

export const useRemoveTeamMemberMutation = createInvalidatingMutation<void, RemoveTeamMemberInputDTO>(
    memberService.remove,
    (_data, variables) => [getTeamMembersListingQueryKey({ teamId: variables.teamId })]
);
