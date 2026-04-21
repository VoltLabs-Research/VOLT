import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { Response } from 'express';
import type { Result } from '@shared/domain/port/Result';
import type { IUseCase, UseCaseError, UseCaseInput, UseCaseInstance, UseCaseOutput } from '@shared/application/IUseCase';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { RequestValidationState, ValidatedRequest } from '@shared/infrastructure/http/middleware/validation';

type ValidatedAuthenticatedRequest = AuthenticatedRequest & ValidatedRequest;

export abstract class BaseController<TUseCase extends UseCaseInstance> {
    constructor(
        protected useCase: TUseCase,
        private readonly statusCode: HttpStatus = HttpStatus.OK
    ){}

    protected abstract getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase>;

    protected getValidatedRequestData(req: AuthenticatedRequest): RequestValidationState {
        const validatedRequest: ValidatedAuthenticatedRequest = req;
        return validatedRequest.validated ?? {};
    }

    /**
     * Writes a domain-level error (use-case failure) to the response. Kept on
     * the class because BaseStreamController reuses it from inside a stream
     * 'error' listener that fires synchronously, outside the async `handle`
     * promise chain Express 5 would otherwise observe.
     */
    protected handleResultError(res: Response, error: unknown): void {
        BaseResponse.fromError(res, error);
    }

    protected executeUseCase(req: AuthenticatedRequest): Promise<Result<UseCaseOutput<TUseCase>, UseCaseError<TUseCase>>> {
        const dto = this.getParams(req);
        return (this.useCase as IUseCase<UseCaseInput<TUseCase>, UseCaseOutput<TUseCase>, UseCaseError<TUseCase>>).execute(dto);
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

    /**
     * Express 5 automatically forwards rejected promises returned by async
     * route handlers to the registered error middleware, so no try/catch is
     * needed here. Any thrown value (ApplicationError, plain Error, string,
     * Mongoose ValidationError, ...) is normalized by `httpErrorMiddleware`.
     *
     * Request validation is NOT performed here — it is wired by the controller
     * factory (`createController`) as an outer wrapper around this method
     * before the instance is exposed. See Task 4.3 of the complexity-reduction
     * plan.
     */
    public handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const result = await this.executeUseCase(req);

        if (!result.success) {
            return this.handleResultError(res, result.error);
        }

        return await this.handleSuccess(req, res, result.value);
    };
};
