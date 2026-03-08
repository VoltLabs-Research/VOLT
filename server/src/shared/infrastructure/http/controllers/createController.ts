import { container } from 'tsyringe';
import { injectable } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';
import type { Response } from 'express';
import { BaseController } from './BaseController';
import type { StreamableOutput } from './BaseStreamController';
import { PaginatedBaseController } from './PaginatedBaseController';
import { BaseStreamController } from './BaseStreamController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { IUseCase, UseCaseInstance, UseCaseOutput } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { RequestValidationState, ValidationSchemaInput } from '@shared/infrastructure/http/middleware/validation';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { UseCaseInput } from '@shared/application/IUseCase';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';

type ControllerSuccessHandler<TUseCase extends UseCaseInstance> = (
    res: Response,
    value: UseCaseOutput<TUseCase>
) => void | Promise<void>;

interface ControllerOptions<TUseCase extends UseCaseInstance = UseCaseInstance> {
    statusCode?: HttpStatus;
    validationSchema?: ValidationSchemaInput;
    getRequestValidationContext?: (req: AuthenticatedRequest) => unknown;
    extendParams?: (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ) => Record<string, unknown>;
    handleSuccess?: ControllerSuccessHandler<TUseCase>;
    handleUnexpectedError?: (res: Response, error: unknown) => void;
}

type DerivedControllerOptions<TUseCase extends UseCaseInstance = UseCaseInstance> = Omit<
    ControllerOptions<TUseCase>,
    'statusCode'
>;

interface StreamControllerOptions<TUseCase extends IUseCase<unknown, StreamableOutput, unknown>>
    extends DerivedControllerOptions<TUseCase> {
    getHeaders?: (resultValue: UseCaseOutput<TUseCase>) => Record<string, string>;
    prepareOutput?: (resultValue: UseCaseOutput<TUseCase>) => Promise<void>;
}

const getControllerOptions = <TOptions extends ControllerOptions>(
    statusCodeOrOptions: HttpStatus | TOptions | undefined,
    fallbackStatusCode: HttpStatus
): TOptions => {
    if (typeof statusCodeOrOptions === 'number') {
        return {
            statusCode: statusCodeOrOptions
        } as TOptions;
    }

    return {
        statusCode: fallbackStatusCode,
        ...statusCodeOrOptions
    } as TOptions;
};

const buildControllerParams = <TUseCase extends UseCaseInstance>(
    req: AuthenticatedRequest,
    validationState: RequestValidationState,
    extendParams?: (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ) => Record<string, unknown>
): UseCaseInput<TUseCase> => {
    const bodyPayload = asRecord(validationState.body ?? req.body) ?? {};
    const baseParams = {
        ...(asRecord(validationState.params ?? req.params) ?? {}),
        ...(asRecord(validationState.query ?? req.query) ?? {}),
        ...(asRecord(validationState.request) ?? {}),
        ...bodyPayload,
        data: bodyPayload,
        userId: req.userId,
        file: req.file,
        files: req.files
    };

    return (extendParams
        ? extendParams(req, baseParams)
        : baseParams) as UseCaseInput<TUseCase>;
};

export const createController = <TUseCase extends UseCaseInstance>(
    useCaseToken: InjectionToken<TUseCase>,
    statusCodeOrOptions: HttpStatus | ControllerOptions<TUseCase> = HttpStatus.OK
) => {
    const options = getControllerOptions(statusCodeOrOptions, HttpStatus.OK);

    @injectable()
    class GeneratedController extends BaseController<TUseCase> {
        constructor() {
            const useCase = container.resolve<TUseCase>(useCaseToken);
            super(useCase, options.statusCode);
        }

        protected override getValidationSchema(): ValidationSchemaInput | undefined {
            return options.validationSchema;
        }

        protected override getRequestValidationContext(req: AuthenticatedRequest): unknown {
            return options.getRequestValidationContext?.(req);
        }

        protected override getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase> {
            return buildControllerParams<TUseCase>(req, this.getValidatedRequestData(req), options.extendParams);
        }

        protected override handleSuccess(res: Response, value: UseCaseOutput<TUseCase>): void | Promise<void> {
            if (options.handleSuccess) {
                return options.handleSuccess(res, value);
            }

            return super.handleSuccess(res, value);
        }

        protected override handleUnexpectedError(res: Response, error: unknown): void {
            if (options.handleUnexpectedError) {
                return options.handleUnexpectedError(res, error);
            }

            return super.handleUnexpectedError(res, error);
        }
    }

    return GeneratedController;
};

export const createPaginatedController = <
    TUseCase extends IUseCase<unknown, PaginatedResult<unknown>, unknown>
>(
    useCaseToken: InjectionToken<TUseCase>,
    options: DerivedControllerOptions<TUseCase> = {}
) => {
    @injectable()
    class GeneratedPaginatedController extends PaginatedBaseController<TUseCase> {
        constructor() {
            const useCase = container.resolve<TUseCase>(useCaseToken);
            super(useCase);
        }

        protected override getValidationSchema(): ValidationSchemaInput | undefined {
            return options.validationSchema;
        }

        protected override getRequestValidationContext(req: AuthenticatedRequest): unknown {
            return options.getRequestValidationContext?.(req);
        }

        protected override getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase> {
            return buildControllerParams<TUseCase>(req, this.getValidatedRequestData(req), options.extendParams);
        }

        protected override handleSuccess(res: Response, value: UseCaseOutput<TUseCase>): void {
            if (options.handleSuccess) {
                void options.handleSuccess(res, value);
                return;
            }

            return super.handleSuccess(res, value);
        }

        protected override handleUnexpectedError(res: Response, error: unknown): void {
            if (options.handleUnexpectedError) {
                return options.handleUnexpectedError(res, error);
            }

            return super.handleUnexpectedError(res, error);
        }
    }

    return GeneratedPaginatedController;
};

export const createStreamController = <
    TUseCase extends IUseCase<unknown, StreamableOutput, unknown>
>(
    useCaseToken: InjectionToken<TUseCase>,
    options: StreamControllerOptions<TUseCase> = {}
) => {
    @injectable()
    class GeneratedStreamController extends BaseStreamController<TUseCase> {
        constructor() {
            const useCase = container.resolve<TUseCase>(useCaseToken);
            super(useCase);
        }

        protected override getValidationSchema(): ValidationSchemaInput | undefined {
            return options.validationSchema;
        }

        protected override getRequestValidationContext(req: AuthenticatedRequest): unknown {
            return options.getRequestValidationContext?.(req);
        }

        protected override getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase> {
            return buildControllerParams<TUseCase>(req, this.getValidatedRequestData(req), options.extendParams);
        }

        protected override getHeaders(resultValue: UseCaseOutput<TUseCase>): Record<string, string> {
            return options.getHeaders
                ? options.getHeaders(resultValue)
                : super.getHeaders(resultValue);
        }

        protected override async prepareOutput(resultValue: UseCaseOutput<TUseCase>): Promise<void> {
            if (options.prepareOutput) {
                await options.prepareOutput(resultValue);
            }
        }

        protected override async handleSuccess(res: Response, value: UseCaseOutput<TUseCase>): Promise<void> {
            if (options.handleSuccess) {
                await options.handleSuccess(res, value);
                return;
            }

            await super.handleSuccess(res, value);
        }

        protected override handleUnexpectedError(res: Response, error: unknown): void {
            if (options.handleUnexpectedError) {
                return options.handleUnexpectedError(res, error);
            }

            return super.handleUnexpectedError(res, error);
        }
    }

    return GeneratedStreamController;
};
