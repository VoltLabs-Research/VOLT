import { sessionValidation } from '@modules/session/infrastructure/http/validation/session-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import RevokeAllSessionsUseCase from '@modules/session/application/use-cases/RevokeAllSessionsUseCase';
import { getSessionRequestContext } from '@modules/session/infrastructure/http/helpers/getSessionRequestContext';

export default createController(RevokeAllSessionsUseCase, {
    validationSchema: sessionValidation.revokeAllOthers,
    getRequestValidationContext: getSessionRequestContext
});
