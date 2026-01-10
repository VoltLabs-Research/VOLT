import { Response } from 'express';
import { PaginatedResult } from '../../domain/IBaseRepository';

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
    static paginated<T>(res: Response, result: PaginatedResult<T>, statusCode: number = 200): void{
        res.status(statusCode).json({
            status: 'success',
            page: {
                current: result.page,
                total: result.totalPages
            } ,
            results: {
                skipped: (result.page - 1) * result.limit,
                total: result.total,
                paginated: result.limit
            },
            data: result.data
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