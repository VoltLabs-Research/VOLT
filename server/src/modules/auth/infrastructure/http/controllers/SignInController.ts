import { createController } from '@shared/infrastructure/http/controllers/createController';
import { getAuthRequestContext } from '@modules/auth/infrastructure/http/helpers/getAuthRequestContext';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';
import SignInUseCase from '@modules/auth/application/use-cases/SignInUseCase';

export default createController(SignInUseCase, {
    validationSchema: authValidation.signIn,
    contextProviders: [getAuthRequestContext]
});
