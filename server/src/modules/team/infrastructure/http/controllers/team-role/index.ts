import CreateTeamRoleController from './CreateTeamRoleController';
import DeleteTeamRoleByIdController from './DeleteTeamRoleByIdController';
import UpdateTeamRoleByIdController from './UpdateTeamRoleByIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    create: CreateTeamRoleController,
    deleteById: DeleteTeamRoleByIdController,
    updateById: UpdateTeamRoleByIdController
});
