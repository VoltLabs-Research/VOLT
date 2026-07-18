import type TeamAIIntegrationHttpService from '@modules/team/services/TeamAIIntegrationHttpService';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

type TeamAIIntegrationHttpMethod = {
    [K in keyof TeamAIIntegrationHttpService]: TeamAIIntegrationHttpService[K] extends (input: never) => Promise<unknown> ? K : never;
}[keyof TeamAIIntegrationHttpService];

type TeamAIIntegrationHttpInput<M extends TeamAIIntegrationHttpMethod> = Parameters<TeamAIIntegrationHttpService[M]>[0];

/**
 * The HTTP controller for the team ai-integration resource. `createByProvider`
 * preserves the former `HttpStatus.Created` response; `deleteByProvider`
 * preserves the former `HttpStatus.NoContent` empty-body response. Thrown
 * `ApplicationError`s propagate to `httpErrorMiddleware` via Express 5 async
 * forwarding.
 */
@injectable()
export default class TeamAIIntegrationController {
    constructor(
        @inject(TEAM_TOKENS.TeamAIIntegrationHttpService) private readonly teamAIIntegrationHttpService: TeamAIIntegrationHttpService
    ) {}

    private params<M extends TeamAIIntegrationHttpMethod>(req: AuthenticatedRequest): TeamAIIntegrationHttpInput<M> {
        return buildControllerParams(req) as unknown as TeamAIIntegrationHttpInput<M>;
    }

    listByTeamId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamAIIntegrationHttpService.listByTeamId(this.params<'listByTeamId'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    createByProvider = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamAIIntegrationHttpService.createByProvider(this.params<'createByProvider'>(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    updateByProvider = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamAIIntegrationHttpService.updateByProvider(this.params<'updateByProvider'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteByProvider = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.teamAIIntegrationHttpService.deleteByProvider(this.params<'deleteByProvider'>(req));
        res.status(HttpStatus.NoContent).send();
    };

    listModels = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.teamAIIntegrationHttpService.listModels(this.params<'listModels'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
