import type TeamHttpService from '@modules/team/services/TeamHttpService';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * Public HTTP-facing method names on {@link TeamHttpService} (every method
 * except the private `run` helper).
 */
type TeamHttpMethod = {
    [K in keyof TeamHttpService]: TeamHttpService[K] extends (input: never) => Promise<unknown> ? K : never;
}[keyof TeamHttpService];

/**
 * The request-derived input type a given service method expects. Lets each
 * handler cast `buildControllerParams` output to the exact use-case input shape
 * without the controller importing the use cases or their DTOs directly.
 */
type TeamHttpInput<M extends TeamHttpMethod> = Parameters<TeamHttpService[M]>[0];

/**
 * The HTTP controller for the team resource. One Express handler per route,
 * assembling the use-case input exactly as `buildControllerParams` did for the
 * generated controllers, delegating to {@link TeamHttpService}, and responding
 * via {@link BaseResponse}.
 *
 * `create` preserves the former `HttpStatus.Created` response; `deleteById` and
 * `leave` preserve the former `HttpStatus.NoContent` empty-body response.
 * Handlers are arrow-function properties so `this` stays bound when passed by
 * reference to the router. Thrown `ApplicationError`s propagate to
 * `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class TeamController {
    constructor(
        @inject(TEAM_TOKENS.TeamHttpService) private readonly teamHttpService: TeamHttpService
    ) {}

    private params<M extends TeamHttpMethod>(req: AuthenticatedRequest): TeamHttpInput<M> {
        return buildControllerParams(req) as unknown as TeamHttpInput<M>;
    }

    create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.create(this.params<'create'>(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.teamHttpService.deleteById(this.params<'deleteById'>(req));
        res.status(HttpStatus.NoContent).send();
    };

    deleteInviteCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.deleteInviteCode(this.params<'deleteInviteCode'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    generateInviteCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.generateInviteCode(this.params<'generateInviteCode'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.getById(this.params<'getById'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    joinByCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.joinByCode(this.params<'joinByCode'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    leave = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.teamHttpService.leave(this.params<'leave'>(req));
        res.status(HttpStatus.NoContent).send();
    };

    listUserTeams = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.listUserTeams(this.params<'listUserTeams'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    previewJoinByCode = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.previewJoinByCode(this.params<'previewJoinByCode'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updateById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.updateById(this.params<'updateById'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    checkInvitePermission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.checkInvitePermission(this.params<'checkInvitePermission'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getMyPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.getMyPermissions(this.params<'getMyPermissions'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    setDefaultForNewUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamHttpService.setDefaultForNewUsers(this.params<'setDefaultForNewUsers'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
