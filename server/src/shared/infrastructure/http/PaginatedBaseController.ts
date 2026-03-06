import type { Response } from 'express';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import logger from '@shared/infrastructure/logger';

export abstract class PaginatedBaseController<TUseCase extends IUseCase<any, PaginatedResult<any>, any>> extends BaseController<TUseCase> {
    public override handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const dto = this.getParams(req);
            const result = await this.useCase.execute(dto);

            if (!result.success) {
                return BaseResponse.error(
                    res,
                    result.error.message,
                    result.error.statusCode,
                    result.error.code
                );
            }

            return BaseResponse.paginated(res, result.value, result.value._meta);
        } catch (error) {
            logger.error(error);
            return BaseResponse.error(
                res,
                'Internal Server Error',
                HttpStatus.InternalServerError,
                'Internal::Server::Error'
            );
        }
    };
}
