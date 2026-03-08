import { createController } from '@shared/infrastructure/http/controllers/createController';
import { getAuthRequestContext } from '@modules/auth/infrastructure/http/helpers/getAuthRequestContext';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import SignUpUseCase from '@modules/auth/application/use-cases/SignUpUseCase';

export default createController(SignUpUseCase, {
    statusCode: HttpStatus.Created,
    validationSchema: authValidation.signUp,
    extendParams: (request, params) => ({
        ...params,
        ...getAuthRequestContext(request)
    })
});
