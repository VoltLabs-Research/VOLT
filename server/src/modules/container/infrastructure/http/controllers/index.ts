import CreateContainerController from './CreateContainerController';
import DeleteContainerController from './DeleteContainerController';
import GetContainerByIdController from './GetContainerByIdController';
import GetContainerFilesController from './GetContainerFilesController';
import GetContainerProcessesController from './GetContainerProcessesController';
import GetContainerStatsController from './GetContainerStatsController';
import ListContainersController from './ListContainersController';
import ReadContainerFileController from './ReadContainerFileController';
import UpdateContainerController from './UpdateContainerController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreateContainerController),
    deleteById: container.resolve(DeleteContainerController),
    getById: container.resolve(GetContainerByIdController),
    getFilesById: container.resolve(GetContainerFilesController),
    getProcessesById: container.resolve(GetContainerProcessesController),
    getStatsById: container.resolve(GetContainerStatsController),
    listByTeamId: container.resolve(ListContainersController),
    readFileById: container.resolve(ReadContainerFileController),
    updateById: container.resolve(UpdateContainerController)
};