import DeleteTeamMemberByIdController from './DeleteTeamMemberByIdController';
import GetTeamMemberByIdController from './GetTeamMemberByIdController';
import ListTeamMembersByTeamIdController from './ListTeamMembersByTeamIdController';
import UpdateTeamMemberByIdController from './UpdateTeamMemberByIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    deleteById: DeleteTeamMemberByIdController,
    getById: GetTeamMemberByIdController,
    listByTeamId: ListTeamMembersByTeamIdController,
    updateById: UpdateTeamMemberByIdController
});