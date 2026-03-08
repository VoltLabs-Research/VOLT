import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { DeleteSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/DeleteSSHConnectionByIdUseCase';

const DeleteSSHConnectionByIdController = createController(DeleteSSHConnectionByIdUseCase, HttpStatus.NoContent);
export default DeleteSSHConnectionByIdController;
