import { createService, get, post, patch, del } from '@/app/core/http/utils/create-service';

import type { EmptyParams, UnwrapMode } from '@voltstack/voltclient';
import type { Team } from '@volt/contracts/modules/team/domain';
import type { TeamScopedParams } from '@/shared/api/request-params';
import type { CreateTeamInput, JoinTeamByCodeInput, UpdateTeamInput } from '@volt/contracts/modules/team/http';
import type { JoinTeamResponse, PreviewJoinTeamResponse } from '@volt/contracts/modules/team/domain';

export type JoinByInviteCodeInput = JoinTeamByCodeInput;

export type JoinByInviteCodeResponse = JoinTeamResponse;

export type PreviewJoinByInviteCodeResponse = PreviewJoinTeamResponse;

export type UpdateTeamParams = TeamScopedParams & UpdateTeamInput;

const TEAM_PERMISSIONS_UNWRAP: UnwrapMode = { field: 'permissions' };

const endpoints = {
    getAll: get<EmptyParams, Team[]>('/'),
    create: post<CreateTeamInput, Team>('/'),
    update: patch<UpdateTeamParams, Team>('/:teamId'),
    delete: del<TeamScopedParams>('/:teamId'),
    generateInviteCode: post<TeamScopedParams, Team>('/:teamId/invite-codes'),
    deleteInviteCode: del<TeamScopedParams>('/:teamId/invite-codes'),
    previewJoinByCode: get<JoinByInviteCodeInput, PreviewJoinByInviteCodeResponse>('/invite-codes/:code'),
    joinByCode: post<JoinByInviteCodeInput, JoinByInviteCodeResponse>('/invite-codes/:code/memberships'),
    leave: del<TeamScopedParams>('/:teamId/self/membership', { unwrap: 'void' }),
    getMyPermissions: get<TeamScopedParams, string[]>(
        '/:teamId/self/permissions', {
            unwrap: TEAM_PERMISSIONS_UNWRAP
        }
    )
};

export default createService({
    clients: {
        default: {
            basePath: '/teams'
        }
    }
}, endpoints);
