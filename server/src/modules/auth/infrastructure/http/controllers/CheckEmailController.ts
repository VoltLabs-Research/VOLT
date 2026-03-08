import { createController } from '@shared/infrastructure/http/controllers/createController';
import CheckEmailUseCase from '@modules/auth/application/use-cases/CheckEmailUseCase';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';

export default createController(CheckEmailUseCase, {
    validationSchema: authValidation.checkEmail
});
