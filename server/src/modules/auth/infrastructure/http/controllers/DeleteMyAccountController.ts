import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import DeleteAccountUseCase from '@modules/auth/application/use-cases/DeleteAccountUseCase';

export default createController(DeleteAccountUseCase, HttpStatus.NoContent);
