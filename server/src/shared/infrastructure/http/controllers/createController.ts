import { BaseController } from './BaseController';
import { BaseStreamController } from './BaseStreamController';
import { PaginatedBaseController } from './PaginatedBaseController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import { container, injectable } from 'tsyringe';
import type { Response } from 'express';
import type { IUseCase, UseCaseInput, UseCaseInstance, UseCaseOutput } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { RequestValidationState, ValidationSchemaInput } from '@shared/infrastructure/http/middleware/validation';
import type { StreamableOutput } from './BaseStreamController';
import type { InjectionToken } from 'tsyringe';

type ControllerSuccessHandler<TUseCase extends UseCaseInstance> = (
    req: AuthenticatedRequest,
    res: Response,
    value: UseCaseOutput<TUseCase>
) => void | Promise<void>;

interface ControllerOptions<TUseCase extends UseCaseInstance = UseCaseInstance> {
    statusCode?: HttpStatus;
    validationSchema?: ValidationSchemaInput;
    extendParams?: (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ) => Record<string, unknown>;
    handleSuccess?: ControllerSuccessHandler<TUseCase>;
    handleUnexpectedError?: (res: Response, error: unknown) => void;
};

type DerivedControllerOptions<TUseCase extends UseCaseInstance = UseCaseInstance> = Omit<
    ControllerOptions<TUseCase>,
    'statusCode'
>;

const readUserAgent = (req: AuthenticatedRequest): string => {
    const userAgent = req.headers['user-agent'];

    return Array.isArray(userAgent) ? userAgent[0] ?? '' : userAgent ?? '';
};

const buildRequestValidationContext = (req: AuthenticatedRequest): Record<string, unknown> => {
    return {
        userId: req.userId,
        token: req.token
    };
};

interface StreamControllerOptions<TUseCase extends IUseCase<unknown, StreamableOutput, unknown>>
    extends DerivedControllerOptions<TUseCase> {
    getHeaders?: (resultValue: UseCaseOutput<TUseCase>) => Record<string, string>;
    prepareOutput?: (resultValue: UseCaseOutput<TUseCase>) => Promise<void>;
};

type PreparedDownloadStreamControllerOptions<
    TUseCase extends IUseCase<unknown, StreamableOutput, unknown>
> = Omit<StreamControllerOptions<TUseCase>, 'getHeaders' | 'prepareOutput'>;

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

const buildControllerParams = (
    req: AuthenticatedRequest,
    validationState: RequestValidationState,
    extendParams?: (
        req: AuthenticatedRequest,
        params: Record<string, unknown>
    ) => Record<string, unknown>
): Record<string, unknown> => {
    const bodyPayload = asRecord(validationState.body ?? req.body) ?? {};
    const baseParams = {
        ...(asRecord(validationState.params ?? req.params) ?? {}),
        ...(asRecord(validationState.query ?? req.query) ?? {}),
        ...(asRecord(validationState.request) ?? {}),
        ...bodyPayload,
        data: bodyPayload,
        userId: req.userId,
        authenticatedUserId: req.userId,
        token: req.token,
        authType: req.authType,
        secretKeyId: req.secretKeyId,
        secretKeyTeamId: req.secretKeyTeamId,
        secretKeyRoleId: req.secretKeyRoleId,
        ip: req.ip || req.socket.remoteAddress || '',
        userAgent: readUserAgent(req),
        traceId: req.requestContext?.traceId,
        requestContext: req.requestContext,
        file: req.file,
        files: req.files
    };

    if (!extendParams) {
        return baseParams;
    }

    return extendParams(req, baseParams);
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
            return buildRequestValidationContext(req);
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

        protected override handleUnexpectedError(res: Response, error: unknown): void {
            if (options.handleUnexpectedError) {
                return options.handleUnexpectedError(res, error);
            }

            return super.handleUnexpectedError(res, error);
        }
    };

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
            return buildRequestValidationContext(req);
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

            super.handleSuccess(req, res, value);
        }

        protected override handleUnexpectedError(res: Response, error: unknown): void {
            if (options.handleUnexpectedError) {
                return options.handleUnexpectedError(res, error);
            }

            return super.handleUnexpectedError(res, error);
        }
    };

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
            return buildRequestValidationContext(req);
        }

        protected override getParams(req: AuthenticatedRequest): UseCaseInput<TUseCase> {
            return buildControllerParams(
                req,
                this.getValidatedRequestData(req),
                options.extendParams
            ) as UseCaseInput<TUseCase>;
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

        protected override async handleSuccess(
            req: AuthenticatedRequest,
            res: Response,
            value: UseCaseOutput<TUseCase>
        ): Promise<void> {
            if (options.handleSuccess) {
                await options.handleSuccess(req, res, value);
                return;
            }

            await super.handleSuccess(req, res, value);
        }

        protected override handleUnexpectedError(res: Response, error: unknown): void {
            if (options.handleUnexpectedError) {
                return options.handleUnexpectedError(res, error);
            }

            return super.handleUnexpectedError(res, error);
        }
    };

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
