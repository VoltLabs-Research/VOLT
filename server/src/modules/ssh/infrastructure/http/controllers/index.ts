import CreateSSHConnectionController from './CreateSSHConnectionController';
import DeleteSSHConnectionByIdController from './DeleteSSHConnectionByIdController';
import GetSSHConnectionsByTeamIdController from './GetSSHConnectionsByTeamIdController';
import ListSSHFilesController from './ListSSHFilesController';
import TestSSHConnectionsByIdController from './TestSSHConnectionByIdController';
import UpdateSSHConnectionByIdController from './UpdateSSHConnectionByIdController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreateSSHConnectionController),
    deleteById: container.resolve(DeleteSSHConnectionByIdController),
    listByTeamId: container.resolve(GetSSHConnectionsByTeamIdController),
    testById: container.resolve(TestSSHConnectionsByIdController),
    updateById: container.resolve(UpdateSSHConnectionByIdController),
    listFiles: container.resolve(ListSSHFilesController)
};