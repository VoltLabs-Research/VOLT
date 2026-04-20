import { ErrorCodes } from '@core/constants/error-codes';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { Response } from 'express';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

interface NormalizedErrorMetadata {
    code?: string;
    message?: string;
    statusCode?: number;
};

interface NormalizedError {
    code?: string;
    message?: string;
    statusCode: number;
};

const isStatusCode = (value: unknown): value is number => {
    return typeof value === 'number' && Number.isInteger(value);
};

const getStringProperty = (value: Record<string, unknown> | undefined, property: string): string | undefined => {
    const propertyValue = value?.[property];

    if (typeof propertyValue !== 'string') {
        return undefined;
    }

    return propertyValue;
};

const getStatusCodeProperty = (value: Record<string, unknown> | undefined, property: string): number | undefined => {
    const propertyValue = value?.[property];

    if (!isStatusCode(propertyValue)) {
        return undefined;
    }

    return propertyValue;
};

const getErrorStatusCode = (value: Record<string, unknown> | undefined): number | undefined => {
    return getStatusCodeProperty(value, 'statusCode') ?? getStatusCodeProperty(value, 'status');
};

const getFirstRecordValue = (value: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
    if (!value) {
        return undefined;
    }

    for (const nestedValue of Object.values(value)) {
        const nestedRecord = asRecord(nestedValue);

        if (nestedRecord) {
            return nestedRecord;
        }
    }

    return undefined;
};

const looksLikeErrorCode = (value: string): boolean => {
    return value.includes('::');
};

const normalizeValidationError = (errorRecord: Record<string, unknown>): NormalizedErrorMetadata | undefined => {
    const errorName = getStringProperty(errorRecord, 'name');
    const nestedValidationErrors = asRecord(errorRecord.errors);

    if (errorName !== 'ValidationError' && nestedValidationErrors === undefined) {
        return undefined;
    }

    const validationError = getFirstRecordValue(nestedValidationErrors);

    if (!validationError) {
        return {
            message: getStringProperty(errorRecord, 'message'),
            statusCode: HttpStatus.BadRequest
        };
    }

    const properties = asRecord(validationError.properties);
    const reason = asRecord(validationError.reason);
    const message = getStringProperty(properties, 'message')
        ?? getStringProperty(validationError, 'message')
        ?? getStringProperty(reason, 'message');
    const explicitCode = getStringProperty(validationError, 'code')
        ?? getStringProperty(properties, 'code')
        ?? getStringProperty(reason, 'code');

    return {
        code: explicitCode ?? (message && looksLikeErrorCode(message) ? message : undefined),
        message,
        statusCode: getErrorStatusCode(validationError) ?? HttpStatus.BadRequest
    };
};

const normalizeError = (error: unknown): NormalizedError => {
    if (error instanceof ApplicationError) {
        return {
            code: error.code,
            message: error.message,
            statusCode: error.statusCode
        };
    }

    if (typeof error === 'string') {
        return {
            message: error,
            statusCode: HttpStatus.InternalServerError
        };
    }

    const errorRecord = asRecord(error);

    if (!errorRecord) {
        return {
            code: ErrorCodes.INTERNAL_SERVER_ERROR,
            statusCode: HttpStatus.InternalServerError
        };
    }

    const validationError = normalizeValidationError(errorRecord);
    const statusCode = getErrorStatusCode(errorRecord) ?? validationError?.statusCode;
    const code = getStringProperty(errorRecord, 'code')
        ?? validationError?.code;
    const message = validationError?.message
        ?? getStringProperty(errorRecord, 'message');
    const isNativeError = error instanceof Error;

    if (statusCode !== undefined || code !== undefined || validationError || (message !== undefined && !isNativeError)) {
        return {
            ...(code ? { code } : {}),
            ...(message ? { message } : {}),
            statusCode: statusCode ?? HttpStatus.InternalServerError
        };
    }

    return {
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        statusCode: HttpStatus.InternalServerError
    };
};

const getErrorMessage = (error: NormalizedError): string => {
    if (error.statusCode >= HttpStatus.InternalServerError && error.code === ErrorCodes.INTERNAL_SERVER_ERROR) {
        return 'Internal Server Error';
    }

    if (error.message) {
        return error.message;
    }

    if (error.code) {
        return error.code;
    }

    return 'Internal Server Error';
};

const sendError = (res: Response, error: NormalizedError): void => {
    res.status(error.statusCode).json({
        status: 'error',
        ...(error.code ? { code: error.code } : {}),
        message: getErrorMessage(error),
        statusCode: error.statusCode
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
        sendError(res, {
            ...(code ? { code } : {}),
            message,
            statusCode
        });
    }

    static fromError(res: Response, error: unknown): void {
        sendError(res, normalizeError(error));
    }
};
