import type TeamMemberHttpService from '@modules/team/services/TeamMemberHttpService';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

type TeamMemberHttpMethod = {
    [K in keyof TeamMemberHttpService]: TeamMemberHttpService[K] extends (input: never) => Promise<unknown> ? K : never;
}[keyof TeamMemberHttpService];

type TeamMemberHttpInput<M extends TeamMemberHttpMethod> = Parameters<TeamMemberHttpService[M]>[0];

/**
 * The HTTP controller for the team-member resource. `listByTeamId` preserves
 * the paginated envelope (`BaseResponse.paginated` with the result's `_meta`);
 * `deleteById` preserves the former `HttpStatus.NoContent` empty-body response
 * and the `teamMemberId := memberId` param mapping the generated controller's
 * `extendParams` performed. Thrown `ApplicationError`s propagate to
 * `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class TeamMemberController {
    constructor(
        @inject(TEAM_TOKENS.TeamMemberHttpService) private readonly teamMemberHttpService: TeamMemberHttpService
    ) {}

    private params<M extends TeamMemberHttpMethod>(
        req: AuthenticatedRequest,
        extend?: (req: AuthenticatedRequest, params: Record<string, unknown>) => Record<string, unknown>
    ): TeamMemberHttpInput<M> {
        return buildControllerParams(req, extend) as unknown as TeamMemberHttpInput<M>;
    }

    listByTeamId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamMemberHttpService.listByTeamId(this.params<'listByTeamId'>(req));
        BaseResponse.paginated(res, value, value._meta);
    };

    updateById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamMemberHttpService.updateById(this.params<'updateById'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.teamMemberHttpService.deleteById(this.params<'deleteById'>(req, (_request, params) => ({
            ...params,
            teamMemberId: params.memberId
        })));
        res.status(HttpStatus.NoContent).send();
    };
}
