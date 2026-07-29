import { ErrorCodes } from '@core/constants/error-codes';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import type { ErrorRequestHandler, Response } from 'express';

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

/**
 * Constraint violations are caused by the request, not by the server, so they
 * must not surface as 500s carrying the raw driver message (which would also
 * leak table and column names). Codes that signal a genuine server defect —
 * undefined column, syntax error — are deliberately absent so they stay 500.
 */
const DATABASE_CONSTRAINT_ERRORS: Record<string, Required<NormalizedErrorMetadata>> = {
    '23502': {
        code: ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS,
        message: 'A required field is missing',
        statusCode: HttpStatus.BadRequest
    },
    '23503': {
        code: ErrorCodes.VALIDATION_INVALID_INPUT,
        message: 'A referenced resource does not exist',
        statusCode: HttpStatus.BadRequest
    },
    '23505': {
        code: ErrorCodes.VALIDATION_DUPLICATE_RESOURCE,
        message: 'A resource with these values already exists',
        statusCode: HttpStatus.Conflict
    },
    '22P02': {
        code: ErrorCodes.VALIDATION_INVALID_INPUT,
        message: 'A field has an invalid value format',
        statusCode: HttpStatus.BadRequest
    }
};

const normalizeDatabaseError = (errorRecord: Record<string, unknown>): Required<NormalizedErrorMetadata> | undefined => {
    if (getStringProperty(errorRecord, 'name') !== 'QueryFailedError') {
        return undefined;
    }

    const sqlState = getStringProperty(errorRecord, 'code');

    return sqlState ? DATABASE_CONSTRAINT_ERRORS[sqlState] : undefined;
};

const normalizeCastError = (errorRecord: Record<string, unknown>): NormalizedErrorMetadata | undefined => {
    if (getStringProperty(errorRecord, 'name') !== 'CastError') {
        return undefined;
    }

    const path = getStringProperty(errorRecord, 'path');

    return {
        code: ErrorCodes.VALIDATION_INVALID_INPUT,
        message: path ? `Invalid value for "${path}"` : 'Invalid identifier',
        statusCode: HttpStatus.BadRequest
    };
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

    const databaseError = normalizeDatabaseError(errorRecord);

    if (databaseError) {
        return databaseError;
    }

    const validationError = normalizeCastError(errorRecord) ?? normalizeValidationError(errorRecord);
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

export const sendNormalizedError = (res: Response, error: NormalizedError): void => {
    res.status(error.statusCode).json({
        status: 'error',
        ...(error.code ? { code: error.code } : {}),
        message: getErrorMessage(error),
        statusCode: error.statusCode
    });
};

export const httpErrorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
    logger.error(error);

    if (response.headersSent) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
    }

    sendNormalizedError(response, normalizeError(error));
};
