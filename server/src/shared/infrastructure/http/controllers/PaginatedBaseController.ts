import type { Response } from 'express';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { BaseController } from '@shared/infrastructure/http/controllers/BaseController';

export abstract class PaginatedBaseController<
    TUseCase extends IUseCase<unknown, PaginatedResult<unknown>, unknown>
> extends BaseController<TUseCase> {
    protected override handleSuccess(res: Response, value: PaginatedResult<unknown>): void {
        BaseResponse.paginated(res, value, value._meta);
    }
}
