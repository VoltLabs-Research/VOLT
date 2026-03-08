import { sessionValidation } from '@modules/session/infrastructure/http/validation/session-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetLoginActivityUseCase from '@modules/session/application/use-cases/GetLoginActivityUseCase';
import { getSessionRequestContext } from '@modules/session/infrastructure/http/helpers/getSessionRequestContext';

export default createController(GetLoginActivityUseCase, {
    validationSchema: sessionValidation.getLoginActivity,
    getRequestValidationContext: getSessionRequestContext
});
