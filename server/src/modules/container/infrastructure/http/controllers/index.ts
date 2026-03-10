import CreateContainerController from './CreateContainerController';
import DeleteContainerByIdController from './DeleteContainerByIdController';
import GetContainerByIdController from './GetContainerByIdController';
import GetContainerFilesByIdController from './GetContainerFilesByIdController';
import GetContainerProcessesByIdController from './GetContainerProcessesByIdController';
import GetContainerStatsByIdController from './GetContainerStatsByIdController';
import ListContainersByTeamIdController from './ListContainersByTeamIdController';
import ReadContainerFileByIdController from './ReadContainerFileByIdController';
import UpdateContainerByIdController from './UpdateContainerByIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    create: CreateContainerController,
    deleteById: DeleteContainerByIdController,
    getById: GetContainerByIdController,
    getFilesById: GetContainerFilesByIdController,
    getProcessesById: GetContainerProcessesByIdController,
    getStatsById: GetContainerStatsByIdController,
    listByTeamId: ListContainersByTeamIdController,
    readFileById: ReadContainerFileByIdController,
    updateById: UpdateContainerByIdController
});