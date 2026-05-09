import CreateContainerController from './CreateContainerController';
import CreateContainerPortProxySessionController from './CreateContainerPortProxySessionController';
import DeleteContainerByIdController from './DeleteContainerByIdController';
import GetContainerByIdController from './GetContainerByIdController';
import GetContainerFilesByIdController from './GetContainerFilesByIdController';
import GetContainerProcessesByIdController from './GetContainerProcessesByIdController';
import GetContainerStatsByIdController from './GetContainerStatsByIdController';
import ListContainersByTeamIdController from './ListContainersByTeamIdController';
import MoveContainerController from './MoveContainerController';
import ReadContainerFileByIdController from './ReadContainerFileByIdController';
import UpdateContainerByIdController from './UpdateContainerByIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    create: CreateContainerController,
    createPortProxySession: CreateContainerPortProxySessionController,
    deleteById: DeleteContainerByIdController,
    getById: GetContainerByIdController,
    getFilesById: GetContainerFilesByIdController,
    getProcessesById: GetContainerProcessesByIdController,
    getStatsById: GetContainerStatsByIdController,
    listByTeamId: ListContainersByTeamIdController,
    move: MoveContainerController,
    readFileById: ReadContainerFileByIdController,
    updateById: UpdateContainerByIdController
});
