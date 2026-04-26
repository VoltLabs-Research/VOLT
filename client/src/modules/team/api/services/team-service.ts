import { createService, get, post, patch, del } from '@/app/core/http/utilities/create-service';

import type { EmptyParams, UnwrapMode } from '@/app/core/http/utilities/create-service';
import type { Team } from '../entities/team/team';
import type { CreateTeamInputDTO } from '../dtos/team/create-team';
import type { UpdateTeamInputDTO } from '../dtos/team/update-team';
import type { DeleteTeamInputDTO } from '../dtos/team/delete-team';
import type { GenerateInviteCodeInputDTO } from '../dtos/team/generate-invite-code';
import type { DeleteInviteCodeInputDTO } from '../dtos/team/delete-invite-code';
import type { JoinByInviteCodeInputDTO, JoinByInviteCodeOutputDTO } from '../dtos/team/join-by-invite-code';
import type {
    PreviewJoinByInviteCodeInputDTO,
    PreviewJoinByInviteCodeOutputDTO
} from '../dtos/team/preview-join-by-invite-code';
import type { GetTeamPermissionsInputDTO, GetTeamPermissionsOutputDTO } from '../dtos/team/get-team-permissions';
import type { LeaveTeamInputDTO } from '../dtos/team/leave-team';

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
