import CreateTeamController from './CreateTeamController';
import DeleteTeamByIdController from './DeleteTeamByIdController';
import DeleteTeamInviteCodeController from './DeleteTeamInviteCodeController';
import GenerateTeamInviteCodeController from './GenerateTeamInviteCodeController';
import GetTeamByIdController from './GetTeamByIdController';
import JoinTeamByInviteCodeController from './JoinTeamByInviteCodeController';
import LeaveTeamController from './LeaveTeamController';
import ListUserTeamsController from './ListUserTeamsController';
import PreviewJoinTeamByInviteCodeController from './PreviewJoinTeamByInviteCodeController';
import UpdateTeamByIdController from './UpdateTeamByIdController';
import CheckInvitePermissionController from './CheckInvitePermissionController';
import GetMyTeamPermissionsController from './GetMyTeamPermissionsController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    create: CreateTeamController,
    deleteById: DeleteTeamByIdController,
    deleteInviteCode: DeleteTeamInviteCodeController,
    generateInviteCode: GenerateTeamInviteCodeController,
    getById: GetTeamByIdController,
    joinByCode: JoinTeamByInviteCodeController,
    leave: LeaveTeamController,
    listUserTeams: ListUserTeamsController,
    previewJoinByCode: PreviewJoinTeamByInviteCodeController,
    updateById: UpdateTeamByIdController,
    checkInvitePermission: CheckInvitePermissionController,
    getMyPermissions: GetMyTeamPermissionsController
});
