import { BaseController } from './BaseController';
import { BaseStreamController } from './BaseStreamController';
import { PaginatedBaseController } from './PaginatedBaseController';
import {
    buildControllerParams,
    wrapHandleWithValidation
} from './controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import logger from '@shared/infrastructure/logger';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { container, injectable } from 'tsyringe';
import type { Response } from 'express';
import type { IUseCase, UseCaseInput, UseCaseInstance, UseCaseOutput } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { ValidationSchemaInput } from '@shared/infrastructure/http/middleware/validation';
import type { StreamableOutput } from './BaseStreamController';
import type { InjectionToken } from 'tsyringe';

type ControllerSuccessHandler<TUseCase extends UseCaseInstance> = (
    req: AuthenticatedRequest,
    res: Response,
    value: UseCaseOutput<TUseCase>
) => void | Promise<void>;

type ControllerUnexpectedErrorHandler = (res: Response, error: unknown) => void;

interface ControllerOptions<TUseCase extends UseCaseInstance = UseCaseInstance> {
    statusCode?: HttpStatus;
    validationSchema?: ValidationSchemaInput;
    extendParams?: (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ) => Record<string, unknown>;
    handleSuccess?: ControllerSuccessHandler<TUseCase>;
    /**
     * Opt-in escape hatch: if provided, ANY rejection bubbling out of `handle`
     * is routed here instead of reaching the global error middleware. Prefer
     * throwing a typed ApplicationError from the use case over using this.
     */
    handleUnexpectedError?: ControllerUnexpectedErrorHandler;
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

type PreparedDownloadStreamControllerOptions<
    TUseCase extends IUseCase<unknown, StreamableOutput, unknown>
> = Omit<StreamControllerOptions<TUseCase>, 'getHeaders' | 'prepareOutput'>;

// ---------------------------------------------------------------------------
// Shared helpers — identical across every variant, defined once.
// See also `controller-internals.ts` for the bits shared with
// `createReadController.ts`.
// ---------------------------------------------------------------------------

const getControllerOptions = <TUseCase extends UseCaseInstance>(
    statusCodeOrOptions: HttpStatus | ControllerOptions<TUseCase> | undefined,
    fallbackStatusCode: HttpStatus
): ControllerOptions<TUseCase> => {
    if (typeof statusCodeOrOptions === 'number') {
        return {
            statusCode: statusCodeOrOptions
        };
    }

    return {
        statusCode: fallbackStatusCode,
        ...statusCodeOrOptions
    };
};

/**
 * Wraps a controller's `handle` so that any rejection is routed through the
 * `handleUnexpectedError` option — preserving the pre-refactor escape hatch
 * for routes that mask errors with a custom payload. If the override itself
 * throws, we re-throw so the global error middleware picks it up.
 */
const wrapHandleWithUnexpectedErrorHook = <THandler extends (req: AuthenticatedRequest, res: Response) => Promise<void>>(
    handler: THandler,
    onUnexpectedError: ControllerUnexpectedErrorHandler
): THandler => {
    const wrapped = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            await handler(req, res);
        } catch (error) {
            logger.error(error);

            if (res.headersSent) {
                throw error;
            }

            onUnexpectedError(res, error);
        }
    };

    return wrapped as THandler;
};

/**
 * Apply the shared handle wrappers (validation + unexpected-error escape hatch)
 * in the same order used by every generated class. Keeps the per-variant
 * constructor bodies down to a single line.
 */
const composeHandle = <THandler extends (req: AuthenticatedRequest, res: Response) => Promise<void>>(
    handle: THandler,
    validationSchema: ValidationSchemaInput | undefined,
    onUnexpectedError: ControllerUnexpectedErrorHandler | undefined
): THandler => {
    let next = wrapHandleWithValidation(handle, validationSchema);

    if (onUnexpectedError) {
        next = wrapHandleWithUnexpectedErrorHook(next, onUnexpectedError);
    }

    return next;
};

// ---------------------------------------------------------------------------
// Public factories — each returns a concrete class type so call sites keep
// their existing narrowed shape for tsyringe's `container.resolve` / route
// wiring. The shared pieces above eliminate 95% of the duplication that
// used to live inside each factory.
// ---------------------------------------------------------------------------

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

            this.handle = composeHandle(
                this.handle,
                options.validationSchema,
                options.handleUnexpectedError
            );
        }

        protected override getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase> {
            return buildControllerParams(
                req,
                this.getValidatedRequestData(req),
                options.extendParams
            ) as UseCaseInput<TUseCase>;
        }

        protected override handleSuccess(
            req: AuthenticatedRequest,
            res: Response,
            value: UseCaseOutput<TUseCase>
        ): void | Promise<void> {
            if (options.handleSuccess) {
                return options.handleSuccess(req, res, value);
            }

            return super.handleSuccess(req, res, value);
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

            this.handle = composeHandle(
                this.handle,
                options.validationSchema,
                options.handleUnexpectedError
            );
        }

        protected override getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase> {
            return buildControllerParams(
                req,
                this.getValidatedRequestData(req),
                options.extendParams
            ) as UseCaseInput<TUseCase>;
        }

        protected override async handleSuccess(
            req: AuthenticatedRequest,
            res: Response,
            value: UseCaseOutput<TUseCase>
        ): Promise<void> {
            if (options.handleSuccess) {
                await options.handleSuccess(req, res, value);
                return;
            }

            super.handleSuccess(req, res, value as PaginatedResult<unknown>);
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

            this.handle = composeHandle(
                this.handle,
                options.validationSchema,
                options.handleUnexpectedError
            );
        }

        protected override getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase> {
            return buildControllerParams(
                req,
                this.getValidatedRequestData(req),
                options.extendParams
            ) as UseCaseInput<TUseCase>;
        }

        protected override getHeaders(resultValue: StreamableOutput): Record<string, string> {
            return options.getHeaders
                ? options.getHeaders(resultValue as UseCaseOutput<TUseCase>)
                : super.getHeaders(resultValue);
        }

        protected override async prepareOutput(resultValue: StreamableOutput): Promise<void> {
            if (options.prepareOutput) {
                await options.prepareOutput(resultValue as UseCaseOutput<TUseCase>);
            }
        }

        protected override async handleSuccess(
            req: AuthenticatedRequest,
            res: Response,
            value: StreamableOutput
        ): Promise<void> {
            if (options.handleSuccess) {
                await options.handleSuccess(req, res, value as UseCaseOutput<TUseCase>);
                return;
            }

            await super.handleSuccess(req, res, value);
        }
    }

    return GeneratedStreamController;
};

export const createPreparedDownloadStreamController = <
    TUseCase extends IUseCase<unknown, StreamableOutput, unknown>
>(
    useCaseToken: InjectionToken<TUseCase>,
    options: PreparedDownloadStreamControllerOptions<TUseCase> = {}
) =>
    createStreamController(useCaseToken, {
        ...options,
        getHeaders: (resultValue) => {
            const preparedResult = resultValue as UseCaseOutput<TUseCase> & {
                headers: Record<string, string>;
            };

            return preparedResult.headers;
        },
        prepareOutput: async (resultValue) => {
            const preparedResult = resultValue as UseCaseOutput<TUseCase> & {
                prepare?: () => Promise<void>;
            };

            await preparedResult.prepare?.();
        }
    });
