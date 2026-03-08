import GetActiveSessionsController from '@modules/session/infrastructure/http/controllers/GetActiveSessionsController';
import GetLoginActivityController from '@modules/session/infrastructure/http/controllers/GetLoginActivityController';
import RevokeAllSessionsController from '@modules/session/infrastructure/http/controllers/RevokeAllSessionsController';
import RevokeSessionController from '@modules/session/infrastructure/http/controllers/RevokeSessionController';
import { container } from 'tsyringe';

export default {
    getActiveSessions: container.resolve(GetActiveSessionsController),
    getMyLoginActivity: container.resolve(GetLoginActivityController),
    revokeSessionById: container.resolve(RevokeSessionController),
    revokeAllSessions: container.resolve(RevokeAllSessionsController)
};
