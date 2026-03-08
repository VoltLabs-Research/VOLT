import { createController } from '@shared/infrastructure/http/controllers/createController';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';
import CheckEmailUseCase from '@modules/auth/application/use-cases/CheckEmailUseCase';

export default createController(CheckEmailUseCase, {
    validationSchema: authValidation.checkEmail
});
