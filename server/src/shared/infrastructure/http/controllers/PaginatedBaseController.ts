import { BaseController } from '@shared/infrastructure/http/controllers/BaseController';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { Response } from 'express';
import type { IUseCase } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export abstract class PaginatedBaseController<
    TUseCase extends IUseCase<unknown, PaginatedResult<unknown>, unknown>
> extends BaseController<TUseCase> {
    protected override handleSuccess(_req: AuthenticatedRequest, res: Response, value: PaginatedResult<unknown>): void {
        BaseResponse.paginated(res, value, value._meta);
    }
}
