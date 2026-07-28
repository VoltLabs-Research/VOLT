import { createService, paginated, patch, del } from '@/app/core/http/utils/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { TeamMember, TeamMemberStats } from '@volt/contracts/modules/team/domain';
import type { TeamScopedParams } from '@/shared/api/request-params';
import type { UpdateTeamMemberInput } from '@volt/contracts/modules/team/http';

export interface GetTeamMembersParams {
    page: number;
    limit: number;
}

export type GetTeamMembersInput = { teamId: string } & GetTeamMembersParams;

export interface RemoveTeamMemberInput {
    teamId: string;
    memberId: string;
}

export type UpdateTeamMemberParams = TeamScopedParams & { memberId: string } & UpdateTeamMemberInput;

const endpoints = {
    getAll: paginated<GetTeamMembersInput, PaginatedResponse<TeamMemberStats>>('/:teamId/members'),
    update: patch<UpdateTeamMemberParams, TeamMember>('/:teamId/members/:memberId'),
    remove: del<RemoveTeamMemberInput>('/:teamId/members/:memberId', { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
