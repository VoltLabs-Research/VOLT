import { createService, get, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { EmptyParams, UnwrapMode } from '@voltstack/voltclient';
import type { Team } from '../entities/team/team';

export interface CreateTeamInputDTO {
    name: string;
    description: string;
}

export interface DeleteInviteCodeInputDTO {
    teamId: string;
}

export interface DeleteTeamInputDTO {
    teamId: string;
}

export interface GenerateInviteCodeInputDTO {
    teamId: string;
}

export interface GetTeamPermissionsInputDTO {
    teamId: string;
}

export type GetTeamPermissionsOutputDTO = string[];

export interface JoinByInviteCodeInputDTO {
    code: string;
}

export interface JoinByInviteCodeOutputDTO {
    message: string;
    teamId: string;
}

export interface LeaveTeamInputDTO {
    teamId: string;
}

export interface PreviewJoinByInviteCodeInputDTO {
    code: string;
}

export interface PreviewJoinByInviteCodeOutputDTO {
    message: string;
    teamId: string;
    teamName: string;
    ownerName: string;
    isAlreadyMember: boolean;
}

export interface UpdateTeamInputDTO {
    teamId: string;
    name?: string;
    description?: string;
}

const TEAM_PERMISSIONS_UNWRAP: UnwrapMode = { field: 'permissions' };

const endpoints = {
    getAll: get<EmptyParams, Team[]>('/'),
    create: post<CreateTeamInputDTO, Team>('/'),
    update: patch<UpdateTeamInputDTO, Team>('/:teamId'),
    delete: del<DeleteTeamInputDTO>('/:teamId'),
    generateInviteCode: post<GenerateInviteCodeInputDTO, Team>('/:teamId/invite-code'),
    deleteInviteCode: del<DeleteInviteCodeInputDTO>('/:teamId/invite-code'),
    previewJoinByCode: post<PreviewJoinByInviteCodeInputDTO, PreviewJoinByInviteCodeOutputDTO>('/join/preview'),
    joinByCode: post<JoinByInviteCodeInputDTO, JoinByInviteCodeOutputDTO>('/join'),
    leave: del<LeaveTeamInputDTO>('/:teamId/self/membership', { unwrap: 'void' }),
    getMyPermissions: get<GetTeamPermissionsInputDTO, GetTeamPermissionsOutputDTO>(
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
