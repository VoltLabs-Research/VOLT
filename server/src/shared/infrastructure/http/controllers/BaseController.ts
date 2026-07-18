import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { Response } from 'express';
import type { IUseCase, UseCaseInput, UseCaseInstance, UseCaseOutput } from '@shared/application/IUseCase';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export abstract class BaseController<TUseCase extends UseCaseInstance> {
    constructor(
        protected useCase: TUseCase,
        private readonly statusCode: HttpStatus = HttpStatus.OK
    ) {}

    protected abstract getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase>;

    
    protected handleResultError(res: Response, error: unknown): void {
        BaseResponse.fromError(res, error);
    }

    protected executeUseCase(req: AuthenticatedRequest): Promise<UseCaseOutput<TUseCase>> {
        const dto = this.getParams(req);
        return (this.useCase as IUseCase<UseCaseInput<TUseCase>, UseCaseOutput<TUseCase>>).execute(dto);
    }

    protected handleSuccess(_req: AuthenticatedRequest, res: Response, value: UseCaseOutput<TUseCase>): void | Promise<void> {
        if (this.statusCode === HttpStatus.NoContent) {
            res.status(this.statusCode).send();
            return;
        }

        BaseResponse.success(
            res,
            value,
            this.statusCode
        );
    }

    
    public handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = await this.executeUseCase(req);
        return await this.handleSuccess(req, res, value);
    };
}
