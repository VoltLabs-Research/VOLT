import { sessionValidation } from '@modules/session/infrastructure/http/validation/session-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetActiveSessionsUseCase from '@modules/session/application/use-cases/GetActiveSessionsUseCase';
import { getSessionRequestContext } from '@modules/session/infrastructure/http/helpers/getSessionRequestContext';

export default createController(GetActiveSessionsUseCase, {
    validationSchema: sessionValidation.getActiveSessions,
    getRequestValidationContext: getSessionRequestContext
});
