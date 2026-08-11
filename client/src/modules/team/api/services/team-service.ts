import { createService, serviceRoutes } from '@/app/core/http/utils/create-service';
import { teamRoutes } from '@volt/contracts/modules/team/routes';

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

const routes = serviceRoutes('/teams');

const endpoints = {
    getAll: routes.route<EmptyParams, Team[]>(teamRoutes.listUserTeams),
    create: routes.route<CreateTeamInput, Team>(teamRoutes.create),
    update: routes.route<UpdateTeamParams, Team>(teamRoutes.updateById),
    delete: routes.route<TeamScopedParams, void>(teamRoutes.remove, { unwrap: 'void' }),
    generateInviteCode: routes.route<TeamScopedParams, Team>(teamRoutes.generateInviteCode),
    deleteInviteCode: routes.route<TeamScopedParams, void>(teamRoutes.deleteInviteCode, { unwrap: 'void' }),
    previewJoinByCode: routes.route<JoinByInviteCodeInput, PreviewJoinByInviteCodeResponse>(teamRoutes.previewJoinByCode),
    joinByCode: routes.route<JoinByInviteCodeInput, JoinByInviteCodeResponse>(teamRoutes.joinByCode),
    leave: routes.route<TeamScopedParams, void>(teamRoutes.leave, { unwrap: 'void' }),
    getMyPermissions: routes.route<TeamScopedParams, string[]>(
        teamRoutes.getMyPermissions, {
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
