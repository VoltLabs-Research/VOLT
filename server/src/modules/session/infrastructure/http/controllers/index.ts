import { container } from 'tsyringe';
import GetActiveSessionsUseCase from '@modules/session/application/use-cases/GetActiveSessionsUseCase';
import GetLoginActivityUseCase from '@modules/session/application/use-cases/GetLoginActivityUseCase';
import RevokeAllSessionsUseCase from '@modules/session/application/use-cases/RevokeAllSessionsUseCase';
import RevokeSessionUseCase from '@modules/session/application/use-cases/RevokeSessionUseCase';
import { createSessionController } from '@modules/session/infrastructure/http/controllers/createSessionController';
import { sessionValidation } from '@modules/session/infrastructure/http/validation/session-schemas';

export default {
    getActiveSessions: container.resolve(createSessionController(GetActiveSessionsUseCase, {
        validationSchema: sessionValidation.getActiveSessions
    })),
    getMyLoginActivity: container.resolve(createSessionController(GetLoginActivityUseCase, {
        validationSchema: sessionValidation.getLoginActivity
    })),
    revokeSessionById: container.resolve(createSessionController(RevokeSessionUseCase, {
        validationSchema: sessionValidation.revokeById
    })),
    revokeAllSessions: container.resolve(createSessionController(RevokeAllSessionsUseCase, {
        validationSchema: sessionValidation.revokeAllOthers
    }))
};
