import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import SignUpUseCase from '@modules/auth/application/use-cases/SignUpUseCase';

export default createController(SignUpUseCase, {
    statusCode: HttpStatus.Created,
});
