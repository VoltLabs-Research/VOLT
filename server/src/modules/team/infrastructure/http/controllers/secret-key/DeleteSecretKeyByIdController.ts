import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import DeleteSecretKeyByIdUseCase from '@modules/team/application/use-cases/secret-key/DeleteSecretKeyByIdUseCase';

const DeleteSecretKeyByIdController = createController(DeleteSecretKeyByIdUseCase, HttpStatus.NoContent);
export default DeleteSecretKeyByIdController;
