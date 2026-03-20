import { CreateSSHConnectionUseCase } from '@modules/ssh/application/use-cases/CreateSSHConnectionUseCase';
import { DeleteSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/DeleteSSHConnectionByIdUseCase';
import { GetSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/GetSSHConnectionByIdUseCase';
import { GetSSHConnectionsByTeamIdUseCase } from '@modules/ssh/application/use-cases/GetSSHConnectionsByTeamIdUseCase';
import { TestSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/TestSSHConnectionByIdUseCase';
import { UpdateSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/UpdateSSHConnectionByIdUseCase';
import ImportTrajectoryFromSSHUseCase from '@modules/ssh/application/use-cases/ImportTrajectoryFromSSHUseCase';
import ListSSHFilesUseCase from '@modules/ssh/application/use-cases/ListSSHFilesUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController, createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

const CreateSSHConnectionController = createController(CreateSSHConnectionUseCase, HttpStatus.Created);
const DeleteSSHConnectionByIdController = createController(DeleteSSHConnectionByIdUseCase, HttpStatus.NoContent);
const GetSSHConnectionByIdController = createController(GetSSHConnectionByIdUseCase);
const GetSSHConnectionsByTeamIdController = createPaginatedController(GetSSHConnectionsByTeamIdUseCase);
const ImportTrajectoryFromSSHController = createController(ImportTrajectoryFromSSHUseCase, HttpStatus.Created);
const ListSSHFilesController = createController(ListSSHFilesUseCase);
const TestSSHConnectionByIdController = createController(TestSSHConnectionByIdUseCase);
const UpdateSSHConnectionByIdController = createController(UpdateSSHConnectionByIdUseCase);

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
