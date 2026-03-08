import { createController } from '@shared/infrastructure/http/controllers/createController';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';
import UpdateAccountUseCase from '@modules/auth/application/use-cases/UpdateAccountUseCase';

export default createController(UpdateAccountUseCase, {
    validationSchema: authValidation.updateAccount
});
