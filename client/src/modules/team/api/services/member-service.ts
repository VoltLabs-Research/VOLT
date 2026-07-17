import { createService, paginated, patch, del } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { TeamMember, TeamMemberStats } from '@/modules/team/api/types/member/team-member';

export interface GetTeamMembersParams {
    page: number;
    limit: number;
}

export type GetTeamMembersInput = { teamId: string } & GetTeamMembersParams;

export interface RemoveTeamMemberInput {
    teamId: string;
    memberId: string;
}

export interface UpdateTeamMemberInput {
    teamId: string;
    memberId: string;
    role?: string;
}

const endpoints = {
    getAll: paginated<GetTeamMembersInput, PaginatedResponse<TeamMemberStats>>('/:teamId/members'),
    update: patch<UpdateTeamMemberInput, TeamMember>('/:teamId/members/:memberId'),
    remove: del<RemoveTeamMemberInput>('/:teamId/members/:memberId', { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
