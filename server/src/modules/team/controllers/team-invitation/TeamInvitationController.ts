import type TeamInvitationHttpService from '@modules/team/services/TeamInvitationHttpService';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

type TeamInvitationHttpMethod = {
    [K in keyof TeamInvitationHttpService]: TeamInvitationHttpService[K] extends (input: never) => Promise<unknown> ? K : never;
}[keyof TeamInvitationHttpService];

type TeamInvitationHttpInput<M extends TeamInvitationHttpMethod> = Parameters<TeamInvitationHttpService[M]>[0];

/**
 * The HTTP controller for the team-invitation resource. `send` preserves the
 * former `HttpStatus.Created` response; `deleteById` preserves the former
 * `HttpStatus.NoContent` empty-body response. `accept` / `reject` are still
 * dispatched by the routes' inline `status` branch, so their signatures return
 * the delegated promise for that branch. Thrown `ApplicationError`s propagate
 * to `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class TeamInvitationController {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationHttpService) private readonly teamInvitationHttpService: TeamInvitationHttpService
    ) {}

    private params<M extends TeamInvitationHttpMethod>(req: AuthenticatedRequest): TeamInvitationHttpInput<M> {
        return buildControllerParams(req) as unknown as TeamInvitationHttpInput<M>;
    }

    send = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamInvitationHttpService.send(this.params<'send'>(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.teamInvitationHttpService.deleteById(this.params<'deleteById'>(req));
        res.status(HttpStatus.NoContent).send();
    };

    updateById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamInvitationHttpService.updateById(this.params<'updateById'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    accept = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamInvitationHttpService.accept(this.params<'accept'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    reject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamInvitationHttpService.reject(this.params<'reject'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
