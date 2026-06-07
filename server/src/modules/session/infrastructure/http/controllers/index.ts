import GetActiveSessionsUseCase from '@modules/session/application/use-cases/GetActiveSessionsUseCase';
import GetLoginActivityUseCase from '@modules/session/application/use-cases/GetLoginActivityUseCase';
import RevokeAllSessionsUseCase from '@modules/session/application/use-cases/RevokeAllSessionsUseCase';
import RevokeSessionUseCase from '@modules/session/application/use-cases/RevokeSessionUseCase';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';

const GetActiveSessionsController = createController(GetActiveSessionsUseCase, {
});
const GetLoginActivityController = createController(GetLoginActivityUseCase, {
});
const RevokeSessionController = createController(RevokeSessionUseCase, {
    statusCode: HttpStatus.NoContent,
});
const RevokeAllSessionsController = createController(RevokeAllSessionsUseCase, {
});

export default createControllerRegistry({
    getActiveSessions: GetActiveSessionsController,
    getMyLoginActivity: GetLoginActivityController,
    revokeSessionById: RevokeSessionController,
    revokeAllSessions: RevokeAllSessionsController
});
