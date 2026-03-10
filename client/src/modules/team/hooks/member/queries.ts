import memberService from '../../api/services/member';
import { createInvalidatingMutation, createQueryResource } from '@/shared/api/query-resources';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamMember, TeamMemberStats } from '../../api/entities/member/team-member';
import type { UpdateTeamMemberInputDTO } from '../../api/dtos/member/update-team-member';
import type { RemoveTeamMemberInputDTO } from '../../api/dtos/member/remove-team-member';

interface TeamMembersQueryParams {
    teamId: string;
    page: number;
    limit: number;
};

const teamMembersResource = createQueryResource<TeamMembersQueryParams, string, PaginatedResponse<TeamMemberStats>>({
    baseKey: 'team-members',
    rootKey: 'members',
    itemKey: 'membersListing',
    getKeyParam: ({ teamId }) => teamId,
    query: memberService.getAll
});

export const TEAM_MEMBER_QUERY_KEYS = {
    members: teamMembersResource.keys.root,
    membersListing: teamMembersResource.keys.item
};

const invalidateTeamMembersQuery = teamMembersResource.invalidate;

export const useTeamMembersQuery = teamMembersResource.query;

export const buildTeamMembersQueryOptions = teamMembersResource.query.buildOptions;

export const fetchTeamMembers = teamMembersResource.query.fetch;

export const useUpdateTeamMemberMutation = createInvalidatingMutation<TeamMember, UpdateTeamMemberInputDTO>({
    mutationFn: memberService.update,
    onSuccess: (_data, variables) => {
        void invalidateTeamMembersQuery(variables.teamId);
    }
});

export const useRemoveTeamMemberMutation = createInvalidatingMutation<void, RemoveTeamMemberInputDTO>({
    mutationFn: memberService.remove,
    onSuccess: (_data, variables) => {
        void invalidateTeamMembersQuery(variables.teamId);
    }
});
