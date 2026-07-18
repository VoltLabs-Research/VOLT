import type TeamRoleHttpService from '@modules/team/application/TeamRoleHttpService';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

type TeamRoleHttpMethod = {
    [K in keyof TeamRoleHttpService]: TeamRoleHttpService[K] extends (input: never) => Promise<unknown> ? K : never;
}[keyof TeamRoleHttpService];

type TeamRoleHttpInput<M extends TeamRoleHttpMethod> = Parameters<TeamRoleHttpService[M]>[0];

/**
 * The HTTP controller for the team-role resource. `create` preserves the former
 * `HttpStatus.Created` response; `deleteById` preserves the former
 * `HttpStatus.NoContent` empty-body response and the `{ teamId, roleId, userId }`
 * param projection the generated controller's `extendParams` performed. Thrown
 * `ApplicationError`s propagate to `httpErrorMiddleware` via Express 5 async
 * forwarding.
 */
@injectable()
export default class TeamRoleController {
    constructor(
        @inject(TEAM_TOKENS.TeamRoleHttpService) private readonly teamRoleHttpService: TeamRoleHttpService
    ) {}

    private params<M extends TeamRoleHttpMethod>(
        req: AuthenticatedRequest,
        extend?: (req: AuthenticatedRequest, params: Record<string, unknown>) => Record<string, unknown>
    ): TeamRoleHttpInput<M> {
        return buildControllerParams(req, extend) as unknown as TeamRoleHttpInput<M>;
    }

    create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamRoleHttpService.create(this.params<'create'>(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.teamRoleHttpService.deleteById(this.params<'deleteById'>(req, (request, params) => ({
            teamId: params.teamId,
            roleId: params.roleId,
            userId: request.userId
        })));
        res.status(HttpStatus.NoContent).send();
    };

    updateById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamRoleHttpService.updateById(this.params<'updateById'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
