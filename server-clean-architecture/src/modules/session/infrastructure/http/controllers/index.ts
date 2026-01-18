import GetActiveSessionsController from './GetActiveSessionsController';
import GetMyLoginActivityController from './GetMyLoginActivityController';
import RevokeAllSessionsController from './RevokeAllSessionsController';
import RevokeSessionController from './RevokeSessionController';
import { container } from 'tsyringe';

export default {
    getActiveSessions: container.resolve(GetActiveSessionsController),
    getMyLoginActivity: container.resolve(GetMyLoginActivityController),
    revokeSessionById: container.resolve(RevokeSessionController),
    revokeAllSessions: container.resolve(RevokeAllSessionsController)
};