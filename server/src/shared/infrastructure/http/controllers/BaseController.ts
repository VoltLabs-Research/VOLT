import type { Response } from 'express';
import { ErrorCodes } from '@core/constants/error-codes';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Result } from '@shared/domain/port/Result';
import type {
    UseCaseError,
    UseCaseInput,
    UseCaseInstance,
    UseCaseOutput
} from '@shared/application/IUseCase';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import logger from '@shared/infrastructure/logger';
import type {
    RequestValidationState,
    ValidationSchemaInput,
    ValidatedRequest
} from '@shared/infrastructure/http/middleware/validation';
import { validateRequest } from '@shared/infrastructure/http/middleware/validation';

export interface ControllerError {
    message: string;
    statusCode: number;
    code?: string;
}

export abstract class BaseController<TUseCase extends UseCaseInstance> {
    constructor(
        protected useCase: TUseCase,
        private readonly statusCode: HttpStatus = HttpStatus.OK
    ){}

    protected abstract getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase>;

    protected getValidationSchema(): ValidationSchemaInput | undefined {
        return undefined;
    }

    protected getValidatedRequestData(req: AuthenticatedRequest): RequestValidationState {
        const validatedRequest = req as AuthenticatedRequest & ValidatedRequest;
        return validatedRequest.validated ?? {};
    }

    protected getRequestValidationContext(_req: AuthenticatedRequest): unknown {
        return undefined;
    }

    protected validate(req: AuthenticatedRequest): ControllerError | null {
        const validationSchema = this.getValidationSchema();

        if (!validationSchema) {
            return null;
        }

        const validationResult = validateRequest(
            req as AuthenticatedRequest & ValidatedRequest,
            validationSchema,
            'body',
            this.getRequestValidationContext(req)
        );

        if (validationResult.success) {
            return null;
        }

        return {
            message: validationResult.message,
            statusCode: HttpStatus.BadRequest,
            code: validationResult.code
        };
    }

    protected handleResultError(res: Response, error: unknown): void {
        BaseResponse.fromError(res, error);
    }

    protected handleUnexpectedError(res: Response, error: unknown): void {
        logger.error(error);
        BaseResponse.error(res, 'Internal Server Error', HttpStatus.InternalServerError, ErrorCodes.INTERNAL_SERVER_ERROR);
    }

    protected async executeUseCase(req: AuthenticatedRequest): Promise<Result<UseCaseOutput<TUseCase>, UseCaseError<TUseCase>>> {
        const dto = this.getParams(req);
        return this.useCase.execute(dto) as Promise<Result<UseCaseOutput<TUseCase>, UseCaseError<TUseCase>>>;
    }

    protected handleSuccess(res: Response, value: UseCaseOutput<TUseCase>): void | Promise<void> {
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
        try {
            const validationError = this.validate(req);

            if (validationError) {
                return this.handleResultError(res, validationError);
            }

            const result = await this.executeUseCase(req);

            if (!result.success) {
                return this.handleResultError(res, result.error);
            }

            return await this.handleSuccess(res, result.value);
        } catch (error) {
            return this.handleUnexpectedError(res, error);
        }
    };
};
