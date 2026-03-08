import { createController } from '@shared/infrastructure/http/controllers/createController';
import SignInUseCase from '@modules/auth/application/use-cases/SignInUseCase';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';
import { getAuthRequestContext } from '@modules/auth/infrastructure/http/controllers/auth-controller-helpers';

export default createController(SignInUseCase, {
    validationSchema: authValidation.signIn,
    extendParams: (request, params) => ({
        ...params,
        ...getAuthRequestContext(request)
    })
});
