import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query, CurrentUser, Req } from '@shared/http/params';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import SessionService from '@modules/session/services/SessionService';
import { sessionRoutes } from '@volt/contracts/modules/session/routes';

@Middleware(protect)
export default class SessionController extends Controller {
    #service = new SessionService();

    @Route(sessionRoutes.getActiveSessions)
    getActiveSessions(
        @CurrentUser() userId: string,
        @Req() req: AuthenticatedRequest
    ){
        return this.#service.getActiveSessions(userId, req.token);
    }

    @Route(sessionRoutes.getLoginActivity)
    getLoginActivity(
        @CurrentUser() userId: string,
        @Query('limit') limit?: string
    ){
        return this.#service.getLoginActivity(userId, limit ? Number(limit) : undefined);
    }

    @Route(sessionRoutes.revokeSession)
    async revokeSession(
        @Param('sessionId') sessionId: string,
        @CurrentUser() userId: string
    ){
        await this.#service.revokeSession(sessionId, userId);
    }

    @Route(sessionRoutes.revokeAllSessions)
    revokeAllSessions(
        @CurrentUser() userId: string,
        @Req() req: AuthenticatedRequest
    ){
        return this.#service.revokeAllSessions(userId, req.token ?? '');
    }
}
