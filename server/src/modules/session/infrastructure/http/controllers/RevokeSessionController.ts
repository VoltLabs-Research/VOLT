import { sessionValidation } from '@modules/session/infrastructure/http/validation/session-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import RevokeSessionUseCase from '@modules/session/application/use-cases/RevokeSessionUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(RevokeSessionUseCase, {
    statusCode: HttpStatus.NoContent,
    validationSchema: sessionValidation.revokeById
});
