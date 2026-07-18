import type EarlyAccessService from '@modules/early-access/application/EarlyAccessService';
import type { CreateEarlyAccessSubscriptionInputDTO } from '@modules/early-access/application/dtos/CreateEarlyAccessSubscriptionDTO';
import { EARLY_ACCESS_TOKENS } from '@modules/early-access/infrastructure/di/EarlyAccessTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the early-access module. One Express handler
 * per route, assembling the service input exactly as `buildControllerParams`
 * did for the generated controllers, delegating to {@link EarlyAccessService},
 * and responding via {@link BaseResponse} with the original status codes.
 */
@injectable()
export default class EarlyAccessController {
    constructor(
        @inject(EARLY_ACCESS_TOKENS.EarlyAccessService) private readonly earlyAccessService: EarlyAccessService
    ) {}

    createSubscription = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateEarlyAccessSubscriptionInputDTO;
        const value = await this.earlyAccessService.createSubscription(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };
}
