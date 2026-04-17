import { sessionValidation } from '@modules/session/infrastructure/http/validation/session-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import RevokeAllSessionsUseCase from '@modules/session/application/use-cases/RevokeAllSessionsUseCase';

export default createController(RevokeAllSessionsUseCase, {
    validationSchema: sessionValidation.revokeAllOthers
});
