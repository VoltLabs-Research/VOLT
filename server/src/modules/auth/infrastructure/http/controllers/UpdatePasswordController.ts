import { createController } from '@shared/infrastructure/http/controllers/createController';
import { getAuthRequestContext } from '@modules/auth/infrastructure/http/helpers/getAuthRequestContext';
import { authValidation } from '@modules/auth/infrastructure/http/validation/auth-schemas';
import UpdatePasswordUseCase from '@modules/auth/application/use-cases/UpdatePasswordUseCase';

export default createController(UpdatePasswordUseCase, {
    validationSchema: authValidation.updatePassword,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId ?? '',
        ...getAuthRequestContext(request)
    })
});
