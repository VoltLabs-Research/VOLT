import { Response } from 'express';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { UseCaseInput, UseCaseInstance } from '@shared/application/IUseCase';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import logger from '@shared/infrastructure/logger';

export abstract class BaseController<TUseCase extends UseCaseInstance> {
    constructor(
        protected useCase: TUseCase,
        private readonly statusCode: HttpStatus = HttpStatus.OK
    ){}

    /**
     * This method must be implemented by each controller to map
     * the data from the Request (body, params, query, userId) to the input DTO.
     */
    protected getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase> {
        return {
            ...req.params,
            ...req.query,
            ...req.body,
            file: req.file,
            files: req.files,
            userId: req.userId
        };
    }

    public handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

            return BaseResponse.success(
                res,
                result.value,
                this.statusCode
            )
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
};