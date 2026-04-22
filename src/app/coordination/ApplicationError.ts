export interface ApplicationErrorOptions {
    statusCode?: number;
    isOperational?: boolean;
    headers?: Record<string, string>;
    details?: unknown;
    cause?: unknown;
}

type ApplicationErrorInput = number | ApplicationErrorOptions | undefined;

interface ResolvedApplicationErrorOptions {
    statusCode: number;
    isOperational: boolean;
    headers: Record<string, string>;
    details?: unknown;
    cause?: unknown;
}

const resolveApplicationErrorOptions = (
    input: ApplicationErrorInput
): ResolvedApplicationErrorOptions => {
    if (typeof input === 'number' || input === undefined) {
        return {
            statusCode: input ?? 500,
            isOperational: true,
            headers: {}
        };
    }

    return {
        statusCode: input.statusCode ?? 500,
        isOperational: input.isOperational ?? true,
        headers: input.headers ?? {},
        details: input.details,
        cause: input.cause
    };
};

export default class ApplicationError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly headers: Record<string, string>;
    public readonly details?: unknown;
    public readonly cause?: unknown;

    constructor(
        public readonly code: string,
        public readonly message: string,
        input: ApplicationErrorInput = 500
    ) {
        super(message);
        const options = resolveApplicationErrorOptions(input);
        this.name = 'ApplicationError';
        this.statusCode = options.statusCode;
        this.isOperational = options.isOperational;
        this.headers = options.headers;
        this.details = options.details;
        this.cause = options.cause;
        Object.setPrototypeOf(this, ApplicationError.prototype);
        Error.captureStackTrace?.(this, this.constructor);
    }

    static badRequest(
        code: string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 400 });
    }

    static forbidden(
        code: string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 403 });
    }

    static notFound(
        code: string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 404 });
    }

    static unprocessableEntity(
        code: string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 422 });
    }
}
