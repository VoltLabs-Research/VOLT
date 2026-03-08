import { ErrorCodes, type ErrorCode } from '@core/constants/error-codes';

export default class ApplicationError extends Error {
    constructor(
        public readonly code: ErrorCode | string,
        public readonly message: string,
        public readonly statusCode: number = 500,
        public readonly isOperational: boolean = true
    ) {
        super(message);
        Object.setPrototypeOf(this, ApplicationError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    public static badRequest(code: ErrorCode | string, message: string): ApplicationError {
        return new ApplicationError(code, message, 400);
    }

    public static unauthorized(code: ErrorCode | string, message: string): ApplicationError {
        return new ApplicationError(code, message, 401);
    }

    public static forbidden(code: ErrorCode | string, message: string): ApplicationError {
        return new ApplicationError(code, message, 403);
    }

    public static notFound(code: ErrorCode | string, message: string): ApplicationError {
        return new ApplicationError(code, message, 404);
    }

    public static conflict(code: ErrorCode | string, message: string): ApplicationError {
        return new ApplicationError(code, message, 409);
    }

    public static internalServerError(message: string): ApplicationError {
        return new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, message, 500);
    }
};
