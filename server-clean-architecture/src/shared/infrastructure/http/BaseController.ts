import { Response } from 'express';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import { UseCaseInput, UseCaseInstance } from '@/src/shared/application/IUseCase';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';

export abstract class BaseController<TUseCase extends UseCaseInstance> {
    constructor(
        protected useCase: TUseCase,
        private readonly statusCode: HttpStatus = HttpStatus.OK
    ) { }

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
                    result.error.statusCode
                );
            }

            return BaseResponse.success(
                res,
                result.value,
                this.statusCode
            )
        } catch (error) {
            console.error(error);
            return BaseResponse.error(res, 'Internal Server Error', HttpStatus.InternalServerError);
        }
    };
};