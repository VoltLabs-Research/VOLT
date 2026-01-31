import { Response } from 'express';
import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';

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
     * Success response where data is spread into the root object.
     */
    static spreadSuccess(res: Response, data: any, statusCode: number = 200): void{
        res.status(statusCode).json({
            status: 'success',
            ...(data || {})
        });
    }

    /**
     * Error response.
     */
    static error(res: Response, message: string, statusCode: number = 500): void{
        res.status(statusCode).json({
            status: 'error',
            message,
            statusCode
        });
    }
};