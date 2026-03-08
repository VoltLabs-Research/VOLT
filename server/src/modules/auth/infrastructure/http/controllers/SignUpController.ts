import { createController } from '@shared/infrastructure/http/controllers/createController';
import SignUpUseCase from '@modules/auth/application/use-cases/SignUpUseCase';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';
import { getAuthRequestContext } from '@modules/auth/infrastructure/http/controllers/auth-controller-helpers';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(SignUpUseCase, {
    statusCode: HttpStatus.Created,
    validationSchema: authValidation.signUp,
    extendParams: (request, params) => ({
        ...params,
        ...getAuthRequestContext(request)
    })
});
