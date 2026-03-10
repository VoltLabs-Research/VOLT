import GetActiveSessionsController from '@modules/session/infrastructure/http/controllers/GetActiveSessionsController';
import GetLoginActivityController from '@modules/session/infrastructure/http/controllers/GetLoginActivityController';
import RevokeAllSessionsController from '@modules/session/infrastructure/http/controllers/RevokeAllSessionsController';
import RevokeSessionController from '@modules/session/infrastructure/http/controllers/RevokeSessionController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    getActiveSessions: GetActiveSessionsController,
    getMyLoginActivity: GetLoginActivityController,
    revokeSessionById: RevokeSessionController,
    revokeAllSessions: RevokeAllSessionsController
});