import type { Response } from 'express';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { BaseController } from '@shared/infrastructure/http/BaseController';

export abstract class PaginatedBaseController<TUseCase extends IUseCase<any, PaginatedResult<any>, any>> extends BaseController<TUseCase> {
    public override handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const dto = this.getParams(req);
            const result = await this.useCase.execute(dto);

            if (!result.success) {
                return this.handleResultError(res, result);
            }

            return BaseResponse.paginated(res, result.value, result.value._meta);
        } catch (error) {
            return this.handleUnexpectedError(res, error);
        }
    };
}
