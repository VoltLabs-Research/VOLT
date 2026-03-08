import { ErrorCodes } from '@core/constants/error-codes';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import type { Response } from 'express';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

const getErrorMessage = (message: string | undefined, statusCode: number, code?: string): string => {
    if (statusCode >= HttpStatus.InternalServerError && code === ErrorCodes.INTERNAL_SERVER_ERROR) {
        return 'Internal Server Error';
    }

    if (message) {
        return message;
    }

    if (code && code !== ErrorCodes.INTERNAL_SERVER_ERROR) {
        return code;
    }

    return 'Internal Server Error';
};

const sendError = (res: Response, message: string | undefined, statusCode: number, code?: string): void => {
    res.status(statusCode).json({
        status: 'error',
        ...(code ? { code } : {}),
        message: getErrorMessage(message, statusCode, code),
        statusCode
    });
};

export default class BaseResponse{
    /**
     * Success respones for single item.
     */
    static success<T>(res: Response, data: T, statusCode: number = 200): void{
        res.status(statusCode).json({
            status: 'success',
            data
        });
    }

    /**
     * Paginated response.
     */
    static paginated<T>(res: Response, result: PaginatedResult<T>, metadata?: Record<string, unknown>, statusCode: number = 200): void{
        res.status(statusCode).json({
            status: 'success',
            data: result.data,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
                hasMore: result.page < result.totalPages
            },
            ...(metadata ? { _meta: metadata } : {})
        }); 
    }

    /**
     * Error response.
     */
    static error(
        res: Response,
        message: string,
        statusCode: number = HttpStatus.InternalServerError,
        code?: string
    ): void{
        sendError(res, message, statusCode, code);
    }

    static fromError(res: Response, error: unknown): void {
        const errorRecord = asRecord(error);
        const statusCode = typeof errorRecord?.statusCode === 'number'
            ? errorRecord.statusCode
            : HttpStatus.InternalServerError;
        const code = typeof errorRecord?.code === 'string'
            ? errorRecord.code
            : statusCode >= HttpStatus.InternalServerError
                ? ErrorCodes.INTERNAL_SERVER_ERROR
                : undefined;
        const message = typeof error === 'string'
            ? error
            : typeof errorRecord?.message === 'string'
                ? errorRecord.message
                : undefined;

        sendError(res, message, statusCode, code);
    }
};
