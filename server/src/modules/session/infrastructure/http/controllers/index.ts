import GetActiveSessionsUseCase from '@modules/session/application/use-cases/GetActiveSessionsUseCase';
import GetLoginActivityUseCase from '@modules/session/application/use-cases/GetLoginActivityUseCase';
import RevokeAllSessionsUseCase from '@modules/session/application/use-cases/RevokeAllSessionsUseCase';
import RevokeSessionUseCase from '@modules/session/application/use-cases/RevokeSessionUseCase';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { sessionValidation } from '@modules/session/infrastructure/http/validation/session-schemas';

const GetActiveSessionsController = createController(GetActiveSessionsUseCase, {
    validationSchema: sessionValidation.getActiveSessions
});
const GetLoginActivityController = createController(GetLoginActivityUseCase, {
    validationSchema: sessionValidation.getLoginActivity
});
const RevokeSessionController = createController(RevokeSessionUseCase, {
    statusCode: HttpStatus.NoContent,
    validationSchema: sessionValidation.revokeById
});
const RevokeAllSessionsController = createController(RevokeAllSessionsUseCase, {
    validationSchema: sessionValidation.revokeAllOthers
});

export default createControllerRegistry({
    getActiveSessions: GetActiveSessionsController,
    getMyLoginActivity: GetLoginActivityController,
    revokeSessionById: RevokeSessionController,
    revokeAllSessions: RevokeAllSessionsController
});
