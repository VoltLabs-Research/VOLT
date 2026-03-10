import CreateTeamController from './CreateTeamController';
import DeleteTeamByIdController from './DeleteTeamByIdController';
import GetTeamByIdController from './GetTeamByIdController';
import LeaveTeamController from './LeaveTeamController';
import ListUserTeamsController from './ListUserTeamsController';
import RemoveUserFromTeamController from './RemoveUserFromTeamController';
import UpdateTeamByIdController from './UpdateTeamByIdController';
import CheckInvitePermissionController from './CheckInvitePermissionController';
import GetMyTeamPermissionsController from './GetMyTeamPermissionsController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    create: CreateTeamController,
    deleteById: DeleteTeamByIdController,
    getById: GetTeamByIdController,
    leave: LeaveTeamController,
    listUserTeams: ListUserTeamsController,
    removeUserFromTeam: RemoveUserFromTeamController,
    updateById: UpdateTeamByIdController,
    checkInvitePermission: CheckInvitePermissionController,
    getMyPermissions: GetMyTeamPermissionsController
});