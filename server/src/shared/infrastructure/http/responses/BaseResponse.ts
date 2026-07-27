import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { normalizeError, sendNormalizedError } from '@shared/infrastructure/http/middleware/error';
import type { Response } from 'express';
import type { PaginatedResult } from '@shared/domain/port/persistence';

export default class BaseResponse {
    static success<T>(res: Response, data: T, statusCode: number = 200): void {
        res.status(statusCode).json({
            status: 'success',
            data
        });
    }

    static paginated<T>(res: Response, result: PaginatedResult<T>, metadata?: Record<string, unknown>, statusCode: number = 200): void {
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

    static error(
        res: Response,
        message: string,
        statusCode: number = HttpStatus.InternalServerError,
        code?: string
    ): void {
        sendNormalizedError(res, {
            ...(code ? { code } : {}),
            message,
            statusCode
        });
    }

    static fromError(res: Response, error: unknown): void {
        sendNormalizedError(res, normalizeError(error));
    }
}
