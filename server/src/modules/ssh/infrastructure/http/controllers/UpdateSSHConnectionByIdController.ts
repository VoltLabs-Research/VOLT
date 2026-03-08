import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/UpdateSSHConnectionByIdUseCase';

const UpdateSSHConnectionByIdController = createController(UpdateSSHConnectionByIdUseCase);
export default UpdateSSHConnectionByIdController;
