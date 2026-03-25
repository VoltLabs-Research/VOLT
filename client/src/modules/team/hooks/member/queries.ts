import memberService from '../../api/services/member';
import { createInvalidatingMutation, createQuery } from '@/shared/infrastructure/query';
import { createTeamScopedPaginatedResource } from '../shared/team-scoped-paginated-resource';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamMember, TeamMemberStats } from '../../api/entities/member/team-member';
import type { UpdateTeamMemberInputDTO } from '../../api/dtos/member/update-team-member';
import type { RemoveTeamMemberInputDTO } from '../../api/dtos/member/remove-team-member';

interface TeamMembersQueryParams {
    teamId: string;
    page: number;
    limit: number;
};

interface TeamMembersAggregateQueryParams {
    teamId: string;
    limit: number;
};

export const teamMembersResource = createTeamScopedPaginatedResource({
    baseKey: 'team-members',
    listKeyName: 'members',
    list: memberService.getAll
});

export const TEAM_MEMBER_QUERY_KEYS = teamMembersResource.queryKeys;

export const getTeamMembersListingQueryKey = teamMembersResource.getListingQueryKey;

const getTeamMembersQueryKey = teamMembersResource.getPageQueryKey;

const getAllTeamMembersQueryKey = teamMembersResource.getAggregateQueryKey;

const getAllTeamMembers = teamMembersResource.fetchAllPages;

export const useTeamMembersQuery = createQuery<TeamMembersQueryParams, PaginatedResponse<TeamMemberStats>>(
    getTeamMembersQueryKey,
    memberService.getAll
);

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
