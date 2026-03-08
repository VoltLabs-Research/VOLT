import { createController } from '@shared/infrastructure/http/controllers/createController';
import UpdateAccountUseCase from '@modules/auth/application/use-cases/UpdateAccountUseCase';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';

export default createController(UpdateAccountUseCase, {
    validationSchema: authValidation.updateAccount
});
