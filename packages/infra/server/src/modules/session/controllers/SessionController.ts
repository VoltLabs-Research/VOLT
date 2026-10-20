import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Param, Query, CurrentUser, Req } from '@shared/http/params';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import sessionService from '@modules/session/services/SessionService';
import { sessionRoutes } from '@volt/contracts/modules/session/routes';

@Middleware(protect)
export default class SessionController extends Controller {
    @Route(sessionRoutes.getActiveSessions)
    getActiveSessions(
        @CurrentUser() userId: string,
        @Req() req: AuthenticatedRequest
    ){
        return sessionService.getActiveSessions(userId, req.token);
    }

    @Route(sessionRoutes.getLoginActivity)
    getLoginActivity(
        @CurrentUser() userId: string,
        @Query('limit') limit?: string
    ){
        return sessionService.getLoginActivity(userId, limit ? Number(limit) : undefined);
    }

    @Route(sessionRoutes.revokeSession)
    async revokeSession(
        @Param('sessionId') sessionId: string,
        @CurrentUser() userId: string
    ){
        await sessionService.revokeSession(sessionId, userId);
    }

    @Route(sessionRoutes.revokeAllSessions)
    revokeAllSessions(
        @CurrentUser() userId: string,
        @Req() req: AuthenticatedRequest
    ){
        return sessionService.revokeAllSessions(userId, req.token ?? '');
    }
}
