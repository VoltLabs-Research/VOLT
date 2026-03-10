import CreateTeamRoleController from './CreateTeamRoleController';
import DeleteTeamRoleByIdController from './DeleteTeamRoleByIdController';
import GetTeamRoleByIdController from './GetTeamRoleByIdController';
import ListTeamRolesByTeamIdController from './ListTeamRolesByTeamIdController';
import UpdateTeamRoleByIdController from './UpdateTeamRoleByIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    create: CreateTeamRoleController,
    deleteById: DeleteTeamRoleByIdController,
    getById: GetTeamRoleByIdController,
    listByTeamId: ListTeamRolesByTeamIdController,
    updateById: UpdateTeamRoleByIdController
});