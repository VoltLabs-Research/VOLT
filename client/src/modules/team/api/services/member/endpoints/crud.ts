import { paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamMember } from '@/modules/team/api/entities/team-member';
import type { GetTeamMembersInputDTO } from '../../../dtos/get-team-members';
import type { UpdateTeamMemberInputDTO } from '../../../dtos/update-team-member';
import type { RemoveTeamMemberInputDTO } from '../../../dtos/remove-team-member';

const endpoints = {
    getAll: paginated<GetTeamMembersInputDTO, PaginatedResponse<TeamMember>>('/:teamId/members'),
    update: patch<UpdateTeamMemberInputDTO, TeamMember>('/:teamId/members/:memberId'),
    remove: post<RemoveTeamMemberInputDTO, void>('/:teamId/members/remove', { unwrap: 'void' })
};

export default endpoints;
