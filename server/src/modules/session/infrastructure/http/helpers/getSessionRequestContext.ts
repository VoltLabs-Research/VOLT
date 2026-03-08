import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export const getSessionRequestContext = (request: AuthenticatedRequest) => {
    return {
        userId: request.userId,
        token: request.token,
        sessionId: request.sessionId
    };
};
