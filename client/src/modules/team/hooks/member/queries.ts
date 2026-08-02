import memberService from '../../api/services/member-service';
import { createInvalidatingMutation, createQuery } from '@/shared/query';
import { createTeamScopedPaginatedResource } from '../shared/team-scoped-paginated-resource';
import type { TeamScopedAggregateParams } from '../shared/team-scoped-paginated-resource';
import type { TeamMember, TeamMemberStats } from '@volt/contracts/modules/team/domain';
import type { RemoveTeamMemberInput, UpdateTeamMemberParams } from '../../api/services/member-service';

export const teamMembersResource = createTeamScopedPaginatedResource({
    baseKey: 'team-members',
    listKeyName: 'members',
    list: memberService.getAll
});

export const TEAM_MEMBER_QUERY_KEYS = teamMembersResource.queryKeys;

export const useAllTeamMembersQuery = createQuery<TeamScopedAggregateParams, TeamMemberStats[]>(
    teamMembersResource.getAggregateQueryKey,
    teamMembersResource.fetchAllPages
);

export const useUpdateTeamMemberMutation = createInvalidatingMutation<TeamMember, UpdateTeamMemberParams>(
    memberService.update,
    (_data, variables) => [teamMembersResource.getListingQueryKey(variables.teamId)]
);

export const useRemoveTeamMemberMutation = createInvalidatingMutation<void, RemoveTeamMemberInput>(
    memberService.remove,
    (_data, variables) => [teamMembersResource.getListingQueryKey(variables.teamId)]
);
