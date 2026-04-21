import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { normalizeError, sendNormalizedError } from '@shared/infrastructure/http/middleware/error';
import type { Response } from 'express';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

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
     * Error response with explicit message / status / code.
     */
    static error(
        res: Response,
        message: string,
        statusCode: number = HttpStatus.InternalServerError,
        code?: string
    ): void{
        sendNormalizedError(res, {
            ...(code ? { code } : {}),
            message,
            statusCode
        });
    }

    /**
     * Error response derived from an arbitrary thrown value. Used by places
     * that cannot rely on Express' `next(error)` pipeline (e.g. proxy error
     * listeners that fire after their request has already been detached, or
     * stream pipes failing before headers are sent).
     *
     * Controller-level try/catch no longer calls this — unhandled rejections
     * from BaseController.handle propagate to httpErrorMiddleware instead.
     */
    static fromError(res: Response, error: unknown): void {
        sendNormalizedError(res, normalizeError(error));
    }
};
