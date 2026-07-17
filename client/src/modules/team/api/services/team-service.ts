import { createService, get, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { EmptyParams, UnwrapMode } from '@voltstack/voltclient';
import type { Team } from '../types/team/team';

export interface CreateTeamInput {
    name: string;
    description: string;
}

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

export interface JoinByInviteCodeInput {
    code: string;
}

export interface JoinByInviteCodeResponse {
    message: string;
    teamId: string;
}

export interface LeaveTeamInput {
    teamId: string;
}

export interface PreviewJoinByInviteCodeInput {
    code: string;
}

export interface PreviewJoinByInviteCodeResponse {
    message: string;
    teamId: string;
    teamName: string;
    ownerName: string;
    isAlreadyMember: boolean;
}

export interface UpdateTeamInput {
    teamId: string;
    name?: string;
    description?: string;
}

const TEAM_PERMISSIONS_UNWRAP: UnwrapMode = { field: 'permissions' };

const endpoints = {
    getAll: get<EmptyParams, Team[]>('/'),
    create: post<CreateTeamInput, Team>('/'),
    update: patch<UpdateTeamInput, Team>('/:teamId'),
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
