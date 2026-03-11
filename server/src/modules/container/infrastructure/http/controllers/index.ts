import CreateContainerController from './CreateContainerController';
import CreateContainerFolderController from './CreateContainerFolderController';
import CreateContainerXrdpSessionController from './CreateContainerXrdpSessionController';
import DeleteContainerByIdController from './DeleteContainerByIdController';
import DeleteContainerFolderController from './DeleteContainerFolderController';
import GetContainerByIdController from './GetContainerByIdController';
import GetContainerFolderController from './GetContainerFolderController';
import GetContainerFilesByIdController from './GetContainerFilesByIdController';
import GetContainerProcessesByIdController from './GetContainerProcessesByIdController';
import GetContainerStatsByIdController from './GetContainerStatsByIdController';
import ListContainerFoldersController from './ListContainerFoldersController';
import ListContainersByTeamIdController from './ListContainersByTeamIdController';
import MoveContainerController from './MoveContainerController';
import ReadContainerFileByIdController from './ReadContainerFileByIdController';
import UpdateContainerFolderController from './UpdateContainerFolderController';
import UpdateContainerByIdController from './UpdateContainerByIdController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    create: CreateContainerController,
    createFolder: CreateContainerFolderController,
    createXrdpSession: CreateContainerXrdpSessionController,
    deleteById: DeleteContainerByIdController,
    deleteFolder: DeleteContainerFolderController,
    getById: GetContainerByIdController,
    getFolder: GetContainerFolderController,
    getFilesById: GetContainerFilesByIdController,
    getProcessesById: GetContainerProcessesByIdController,
    getStatsById: GetContainerStatsByIdController,
    listFolders: ListContainerFoldersController,
    listByTeamId: ListContainersByTeamIdController,
    move: MoveContainerController,
    readFileById: ReadContainerFileByIdController,
    updateFolder: UpdateContainerFolderController,
    updateById: UpdateContainerByIdController
});
