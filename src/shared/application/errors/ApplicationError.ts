export interface ApplicationErrorOptions {
    statusCode?: number;
    details?: unknown;
    cause?: unknown;
}

type ApplicationErrorInput = number | ApplicationErrorOptions | undefined;

interface ResolvedApplicationErrorOptions {
    statusCode: number;
    details?: unknown;
    cause?: unknown;
}

const resolveApplicationErrorOptions = (
    input: ApplicationErrorInput
): ResolvedApplicationErrorOptions => {
    if (typeof input === 'number' || input === undefined) {
        return { statusCode: input ?? 500 };
    }

    return {
        statusCode: input.statusCode ?? 500,
        details: input.details,
        cause: input.cause
    };
};

export default class ApplicationError extends Error {
    public readonly statusCode: number;
    public readonly details?: unknown;
    public readonly cause?: unknown;

    constructor(
        public readonly code: string,
        public readonly message: string,
        input: ApplicationErrorInput = 500
    ) {
        super(message);
        const { statusCode, details, cause } = resolveApplicationErrorOptions(input);
        this.name = 'ApplicationError';
        this.statusCode = statusCode;
        this.details = details;
        this.cause = cause;
        Object.setPrototypeOf(this, ApplicationError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(
        code: string,
        message: string,
        options: Omit<ApplicationErrorOptions, 'statusCode'> = {}
    ): ApplicationError {
        return new ApplicationError(code, message, { ...options, statusCode: 400 });
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
