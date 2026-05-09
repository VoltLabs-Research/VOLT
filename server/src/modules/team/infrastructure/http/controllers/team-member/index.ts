import DeleteTeamMemberByIdController from './DeleteTeamMemberByIdController';
import ListTeamMembersByTeamIdController from './ListTeamMembersByTeamIdController';
import UpdateTeamMemberByIdController from './UpdateTeamMemberByIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    deleteById: DeleteTeamMemberByIdController,
    listByTeamId: ListTeamMembersByTeamIdController,
    updateById: UpdateTeamMemberByIdController
});
