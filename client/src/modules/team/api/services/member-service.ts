import { createService, paginated, patch, del } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { TeamMember, TeamMemberStats } from '@/modules/team/api/entities/member/team-member';

export interface GetTeamMembersParams {
    page: number;
    limit: number;
}

export type GetTeamMembersInputDTO = { teamId: string } & GetTeamMembersParams;

export interface RemoveTeamMemberInputDTO {
    teamId: string;
    memberId: string;
}

export interface UpdateTeamMemberInputDTO {
    teamId: string;
    memberId: string;
    role?: string;
}

const endpoints = {
    getAll: paginated<GetTeamMembersInputDTO, PaginatedResponse<TeamMemberStats>>('/:teamId/members'),
    update: patch<UpdateTeamMemberInputDTO, TeamMember>('/:teamId/members/:memberId'),
    remove: del<RemoveTeamMemberInputDTO>('/:teamId/members/:memberId', { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
