import CreateSSHConnectionController from './CreateSSHConnectionController';
import DeleteSSHConnectionByIdController from './DeleteSSHConnectionByIdController';
import GetSSHConnectionByIdController from './GetSSHConnectionByIdController';
import GetSSHConnectionsByTeamIdController from './GetSSHConnectionsByTeamIdController';
import ImportTrajectoryFromSSHController from './ImportTrajectoryFromSSHController';
import ListSSHFilesController from './ListSSHFilesController';
import TestSSHConnectionByIdController from './TestSSHConnectionByIdController';
import UpdateSSHConnectionByIdController from './UpdateSSHConnectionByIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    create: CreateSSHConnectionController,
    deleteById: DeleteSSHConnectionByIdController,
    getById: GetSSHConnectionByIdController,
    importTrajectory: ImportTrajectoryFromSSHController,
    listByTeamId: GetSSHConnectionsByTeamIdController,
    testById: TestSSHConnectionByIdController,
    updateById: UpdateSSHConnectionByIdController,
    listFiles: ListSSHFilesController
});