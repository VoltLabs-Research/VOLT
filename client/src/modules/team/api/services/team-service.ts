import { createService, get, post, patch, del } from '@/app/core/http/utils/create-service';

import type { EmptyParams, UnwrapMode } from '@voltstack/voltclient';
import type { Team } from '@volt/contracts/modules/team/domain';
import type { TeamScopedParams } from '@/shared/api/request-params';
import type { CreateTeamInput, JoinTeamByCodeInput, UpdateTeamInput } from '@volt/contracts/modules/team/http';
import type { JoinTeamResponse, PreviewJoinTeamResponse } from '@volt/contracts/modules/team/domain';


export interface DeleteInviteCodeInput {
    teamId: string;
}

export interface DeleteTeamInput {
    teamId: string;
}

export interface GenerateInviteCodeInput {
    teamId: string;
}

export interface GetTeamPermissionsInput {
    teamId: string;
}

export type GetTeamPermissionsResponse = string[];

export type JoinByInviteCodeInput = JoinTeamByCodeInput;

export type JoinByInviteCodeResponse = JoinTeamResponse;

export interface LeaveTeamInput {
    teamId: string;
}

export type PreviewJoinByInviteCodeInput = JoinTeamByCodeInput;

export type PreviewJoinByInviteCodeResponse = PreviewJoinTeamResponse;

export type UpdateTeamParams = TeamScopedParams & UpdateTeamInput;

const TEAM_PERMISSIONS_UNWRAP: UnwrapMode = { field: 'permissions' };

const endpoints = {
    getAll: get<EmptyParams, Team[]>('/'),
    create: post<CreateTeamInput, Team>('/'),
    update: patch<UpdateTeamParams, Team>('/:teamId'),
    delete: del<DeleteTeamInput>('/:teamId'),
    generateInviteCode: post<GenerateInviteCodeInput, Team>('/:teamId/invite-code'),
    deleteInviteCode: del<DeleteInviteCodeInput>('/:teamId/invite-code'),
    previewJoinByCode: post<PreviewJoinByInviteCodeInput, PreviewJoinByInviteCodeResponse>('/join/preview'),
    joinByCode: post<JoinByInviteCodeInput, JoinByInviteCodeResponse>('/join'),
    leave: del<LeaveTeamInput>('/:teamId/self/membership', { unwrap: 'void' }),
    getMyPermissions: get<GetTeamPermissionsInput, GetTeamPermissionsResponse>(
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
