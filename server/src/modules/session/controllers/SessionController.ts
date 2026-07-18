import type SessionService from '@modules/session/services/SessionService';
import type { GetActiveSessionsInputDTO } from '@modules/session/dtos/GetActiveSessionsDTO';
import type { GetLoginActivityInputDTO } from '@modules/session/dtos/GetLoginActivityDTO';
import type { RevokeAllSessionsInputDTO } from '@modules/session/dtos/RevokeAllSessionsDTO';
import type { RevokeSessionInputDTO } from '@modules/session/dtos/RevokeSessionDTO';
import { SESSION_TOKENS } from '@modules/session/di/SessionTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the session module. One Express handler per
 * route, assembling the input exactly as `buildControllerParams` did for the
 * generated controllers, delegating to {@link SessionService}, and responding
 * via {@link BaseResponse} with the original status codes. Handlers are
 * arrow-function properties so `this` stays bound when passed by reference to
 * the router. Thrown `ApplicationError`s propagate to `httpErrorMiddleware`
 * via Express 5 async forwarding.
 */
@injectable()
export default class SessionController {
    constructor(
        @inject(SESSION_TOKENS.SessionService) private readonly sessionService: SessionService
    ) {}

    getActiveSessions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetActiveSessionsInputDTO;
        const value = await this.sessionService.getActiveSessions(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    revokeSessionById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as RevokeSessionInputDTO;
        await this.sessionService.revokeSession(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    getMyLoginActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetLoginActivityInputDTO;
        const value = await this.sessionService.getLoginActivity(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    revokeAllSessions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as RevokeAllSessionsInputDTO;
        const value = await this.sessionService.revokeAllSessions(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
