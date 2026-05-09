import { ErrorCodes } from '@core/constants/error-codes';
import type { ErrorCode } from '@core/constants/error-codes';

export interface ApplicationErrorOptions {
    statusCode?: number;
    headers?: Record<string, string>;
    details?: unknown;
    cause?: unknown;
}

type ApplicationErrorInput = number | ApplicationErrorOptions | undefined;

interface ResolvedApplicationErrorOptions {
    statusCode: number;
    headers: Record<string, string>;
    details?: unknown;
    cause?: unknown;
}

const resolveApplicationErrorOptions = (input: ApplicationErrorInput): ResolvedApplicationErrorOptions => {
    if (typeof input === 'number' || input === undefined) {
        return {
            statusCode: input ?? 500,
            headers: {}
        };
    }

    return {
        statusCode: input.statusCode ?? 500,
        headers: input.headers ?? {},
        details: input.details,
        cause: input.cause
    };
};

export default class ApplicationError extends Error {
    public readonly statusCode: number;
    public readonly headers: Record<string, string>;
    public readonly details?: unknown;
    public readonly cause?: unknown;

    constructor(
        public readonly code: ErrorCode | string,
        public readonly message: string,
        input: ApplicationErrorInput = 500
    ) {
        super(message);
        const options = resolveApplicationErrorOptions(input);
        this.name = 'ApplicationError';
        this.statusCode = options.statusCode;
        this.headers = options.headers;
        this.details = options.details;
        this.cause = options.cause;
        Object.setPrototypeOf(this, ApplicationError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    public static badRequest(
        code: ErrorCode | string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 400 });
    }

    public static unauthorized(
        code: ErrorCode | string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 401 });
    }

    public static forbidden(
        code: ErrorCode | string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 403 });
    }

    public static notFound(
        code: ErrorCode | string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 404 });
    }

    public static conflict(
        code: ErrorCode | string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 409 });
    }

    public static unprocessableEntity(
        code: ErrorCode | string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 422 });
    }

    public static internalServerError(
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, message, { ...options, statusCode: 500 });
    }
}
