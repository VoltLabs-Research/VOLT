import { createController } from '@shared/infrastructure/http/controllers/createController';
import UpdatePasswordUseCase from '@modules/auth/application/use-cases/UpdatePasswordUseCase';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';
import { getAuthRequestContext } from '@modules/auth/infrastructure/http/controllers/auth-controller-helpers';

export default createController(UpdatePasswordUseCase, {
    validationSchema: authValidation.updatePassword,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId ?? '',
        ...getAuthRequestContext(request)
    })
});
