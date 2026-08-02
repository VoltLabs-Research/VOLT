import { ErrorCodes } from '@core/constants/error-codes';
import type { ErrorCode } from '@core/constants/error-codes';

interface ApplicationErrorOptions {
    statusCode?: number;
    headers?: Record<string, string>;
    cause?: unknown;
}

const withStatus = (statusCode: number) =>
    (code: ErrorCode, message: string): ApplicationError => new ApplicationError(code, message, statusCode);

/**
 * An error the client is allowed to see: it carries the machine-readable code and
 * the HTTP status the middleware should answer with. Anything thrown that is not
 * an `ApplicationError` is treated as a server defect and reported as a 500.
 *
 * `code` is an `ErrorCode`, not a `string`: every code must be declared in
 * `@core/constants/error-codes` so the set the client can receive is knowable
 * from one file. `message` is what the user reads, so it must never be the code.
 */
export default class ApplicationError extends Error {
    public readonly statusCode: number;
    public readonly headers: Record<string, string>;
    public readonly cause?: unknown;

    constructor(
        public readonly code: ErrorCode,
        public readonly message: string,
        input: number | ApplicationErrorOptions = 500
    ) {
        super(message);
        const options = typeof input === 'number' ? { statusCode: input } : input;
        this.name = 'ApplicationError';
        this.statusCode = options.statusCode ?? 500;
        this.headers = options.headers ?? {};
        this.cause = options.cause;
        Object.setPrototypeOf(this, ApplicationError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    public static badRequest = withStatus(400);
    public static unauthorized = withStatus(401);
    public static forbidden = withStatus(403);
    public static notFound = withStatus(404);
    public static conflict = withStatus(409);
    public static unprocessableEntity = withStatus(422);

    public static internalServerError(message: string): ApplicationError {
        return new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, message, 500);
    }
}
