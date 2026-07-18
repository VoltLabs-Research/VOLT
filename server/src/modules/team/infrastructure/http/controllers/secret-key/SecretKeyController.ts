import type SecretKeyHttpService from '@modules/team/application/SecretKeyHttpService';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

type SecretKeyHttpMethod = {
    [K in keyof SecretKeyHttpService]: SecretKeyHttpService[K] extends (input: never) => Promise<unknown> ? K : never;
}[keyof SecretKeyHttpService];

type SecretKeyHttpInput<M extends SecretKeyHttpMethod> = Parameters<SecretKeyHttpService[M]>[0];

/**
 * The HTTP controller for the secret-key resource. `create` preserves the
 * former `HttpStatus.Created` response; `listByTeamId` preserves the paginated
 * envelope (`BaseResponse.paginated` with the result's `_meta`); `deleteById`
 * preserves the former `HttpStatus.NoContent` empty-body response. Thrown
 * `ApplicationError`s propagate to `httpErrorMiddleware` via Express 5 async
 * forwarding.
 */
@injectable()
export default class SecretKeyController {
    constructor(
        @inject(TEAM_TOKENS.SecretKeyHttpService) private readonly secretKeyHttpService: SecretKeyHttpService
    ) {}

    private params<M extends SecretKeyHttpMethod>(req: AuthenticatedRequest): SecretKeyHttpInput<M> {
        return buildControllerParams(req) as unknown as SecretKeyHttpInput<M>;
    }

    create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.secretKeyHttpService.create(this.params<'create'>(req));
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    current = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.secretKeyHttpService.current(this.params<'current'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    listByTeamId = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.secretKeyHttpService.listByTeamId(this.params<'listByTeamId'>(req));
        BaseResponse.paginated(res, value, value._meta);
    };

    revokeById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.secretKeyHttpService.revokeById(this.params<'revokeById'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.secretKeyHttpService.deleteById(this.params<'deleteById'>(req));
        res.status(HttpStatus.NoContent).send();
    };

    teamMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.secretKeyHttpService.teamMetrics(this.params<'teamMetrics'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    keyUsage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.secretKeyHttpService.keyUsage(this.params<'keyUsage'>(req));
        BaseResponse.success(res, value, HttpStatus.OK);
    };
}
