import CreateSSHConnectionController from './CreateSSHConnectionController';
import DeleteSSHConnectionByIdController from './DeleteSSHConnectionByIdController';
import GetSSHConnectionsByTeamIdController from './GetSSHConnectionsByTeamIdController';
import ImportTrajectoryFromSSHController from './ImportTrajectoryFromSSHController';
import ListSSHFilesController from './ListSSHFilesController';
import TestSSHConnectionByIdController from './TestSSHConnectionByIdController';
import UpdateSSHConnectionByIdController from './UpdateSSHConnectionByIdController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreateSSHConnectionController),
    deleteById: container.resolve(DeleteSSHConnectionByIdController),
    importTrajectory: container.resolve(ImportTrajectoryFromSSHController),
    listByTeamId: container.resolve(GetSSHConnectionsByTeamIdController),
    testById: container.resolve(TestSSHConnectionByIdController),
    updateById: container.resolve(UpdateSSHConnectionByIdController),
    listFiles: container.resolve(ListSSHFilesController)
};
