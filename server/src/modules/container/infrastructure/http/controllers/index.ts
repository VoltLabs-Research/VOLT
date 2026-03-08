import CreateContainerController from './CreateContainerController';
import DeleteContainerByIdController from './DeleteContainerByIdController';
import GetContainerByIdController from './GetContainerByIdController';
import GetContainerFilesByIdController from './GetContainerFilesByIdController';
import GetContainerProcessesByIdController from './GetContainerProcessesByIdController';
import GetContainerStatsByIdController from './GetContainerStatsByIdController';
import ListContainersByTeamIdController from './ListContainersByTeamIdController';
import ReadContainerFileByIdController from './ReadContainerFileByIdController';
import UpdateContainerByIdController from './UpdateContainerByIdController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreateContainerController),
    deleteById: container.resolve(DeleteContainerByIdController),
    getById: container.resolve(GetContainerByIdController),
    getFilesById: container.resolve(GetContainerFilesByIdController),
    getProcessesById: container.resolve(GetContainerProcessesByIdController),
    getStatsById: container.resolve(GetContainerStatsByIdController),
    listByTeamId: container.resolve(ListContainersByTeamIdController),
    readFileById: container.resolve(ReadContainerFileByIdController),
    updateById: container.resolve(UpdateContainerByIdController)
};
