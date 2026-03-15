import { paginated, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamMember, TeamMemberStats } from '@/modules/team/api/entities/member/team-member';
import type { GetTeamMembersInputDTO } from '../../../dtos/member/get-team-members';
import type { UpdateTeamMemberInputDTO } from '../../../dtos/member/update-team-member';
import type { RemoveTeamMemberInputDTO } from '../../../dtos/member/remove-team-member';

export default {
    getAll: paginated<GetTeamMembersInputDTO, PaginatedResponse<TeamMemberStats>>('/:teamId/members'),
    update: patch<UpdateTeamMemberInputDTO, TeamMember>('/:teamId/members/:memberId'),
    remove: del<RemoveTeamMemberInputDTO>('/:teamId/members/:memberId', { unwrap: 'void' })
};
