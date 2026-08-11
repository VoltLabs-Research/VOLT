import { createService, paginated, patch, serviceRoutes } from '@/app/core/http/utils/create-service';
import { teamMemberRoutes } from '@volt/contracts/modules/team/routes';

import type { PaginatedResponse } from '@voltstack/voltclient';
import type { TeamMember, TeamMemberStats } from '@volt/contracts/modules/team/domain';
import type { TeamScopedParams } from '@/shared/api/request-params';
import type { UpdateTeamMemberInput } from '@volt/contracts/modules/team/http';

export interface GetTeamMembersParams {
    page: number;
    limit: number;
}

type GetTeamMembersInput = { teamId: string } & GetTeamMembersParams;

export interface RemoveTeamMemberInput {
    teamId: string;
    memberId: string;
}

export type UpdateTeamMemberParams = TeamScopedParams & { memberId: string } & UpdateTeamMemberInput;

const routes = serviceRoutes('/teams');

const endpoints = {
    getAll: paginated<GetTeamMembersInput, PaginatedResponse<TeamMemberStats>>(routes.path(teamMemberRoutes.list)),
    update: patch<UpdateTeamMemberParams, TeamMember>('/:teamId/members/:memberId'),
    remove: routes.route<RemoveTeamMemberInput, void>(teamMemberRoutes.remove, { unwrap: 'void' })
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
