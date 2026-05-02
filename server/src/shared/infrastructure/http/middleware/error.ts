import { ErrorCodes } from '@core/constants/error-codes';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import type { ErrorRequestHandler, Response } from 'express';

/**
 * Normalized error shape emitted over the wire as:
 *     { status: 'error', code?, message, statusCode }
 */
interface NormalizedError {
    code?: string;
    message?: string;
    statusCode: number;
}

interface NormalizedErrorMetadata {
    code?: string;
    message?: string;
    statusCode?: number;
}

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

/**
 * Coerce any thrown value (ApplicationError, Zod error, Mongoose
 * ValidationError, plain Error, string, arbitrary object) into the wire-format
 * triple { code?, message?, statusCode }.
 */
export const normalizeError = (error: unknown): NormalizedError => {
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

/**
 * Write the normalized error to the response using the project's wire contract:
 *     { status: 'error', code?, message, statusCode }
 */
export const sendNormalizedError = (res: Response, error: NormalizedError): void => {
    res.status(error.statusCode).json({
        status: 'error',
        ...(error.code ? { code: error.code } : {}),
        message: getErrorMessage(error),
        statusCode: error.statusCode
    });
};

/**
 * Express 5 error middleware. Receives anything propagated via `next(error)`
 * or thrown/rejected from async route handlers, normalizes it, and writes the
 * canonical error payload. If headers have already been flushed (e.g. a
 * stream that failed mid-pipe), we just destroy the socket.
 */
export const httpErrorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
    logger.error(error);

    if (response.headersSent) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
    }

    sendNormalizedError(response, normalizeError(error));
};
