import { createController } from '@shared/infrastructure/http/controllers/createController';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';
import GetGuestIdentityUseCase from '@modules/auth/application/use-cases/GetGuestIdentityUseCase';

export default createController(GetGuestIdentityUseCase, {
    validationSchema: authValidation.getGuestIdentity
});
