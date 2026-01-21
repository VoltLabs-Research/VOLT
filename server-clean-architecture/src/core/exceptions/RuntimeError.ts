import { ErrorCode } from '@core/constants/error-codes';

export class RuntimeError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(code: ErrorCode, statusCode: number = 500, isOperational = true) {
        super(code);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, RuntimeError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
