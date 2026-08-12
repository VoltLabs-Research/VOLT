import { ErrorCodes } from '@core/constants/error-codes';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import type { ErrorRequestHandler, Response } from 'express';

interface NormalizedError {
    code?: string;
    message?: string;
    statusCode: number;
}

const getStringProperty = (value: Record<string, unknown>, property: string): string | undefined => {
    const propertyValue = value[property];

    return typeof propertyValue === 'string' ? propertyValue : undefined;
};

const getStatusCodeProperty = (value: Record<string, unknown>, property: string): number | undefined => {
    const propertyValue = value[property];

    return typeof propertyValue === 'number' && Number.isInteger(propertyValue) ? propertyValue : undefined;
};

const getErrorStatusCode = (value: Record<string, unknown>): number | undefined => {
    return getStatusCodeProperty(value, 'statusCode') ?? getStatusCodeProperty(value, 'status');
};

const DATABASE_CONSTRAINT_ERRORS: Record<string, NormalizedError> = {
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

const normalizeDatabaseError = (errorRecord: Record<string, unknown>): NormalizedError | undefined => {
    if (getStringProperty(errorRecord, 'name') !== 'QueryFailedError') {
        return undefined;
    }

    const sqlState = getStringProperty(errorRecord, 'code');

    return sqlState ? DATABASE_CONSTRAINT_ERRORS[sqlState] : undefined;
};

const INTERNAL_SERVER_ERROR: NormalizedError = {
    code: ErrorCodes.INTERNAL_SERVER_ERROR,
    statusCode: HttpStatus.InternalServerError
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

    if (!isRecord(error)) {
        return INTERNAL_SERVER_ERROR;
    }

    const databaseError = normalizeDatabaseError(error);

    if (databaseError) {
        return databaseError;
    }

    const statusCode = getErrorStatusCode(error);
    const code = getStringProperty(error, 'code');
    const message = getStringProperty(error, 'message');

    if (statusCode === undefined && code === undefined && (message === undefined || error instanceof Error)) {
        return INTERNAL_SERVER_ERROR;
    }

    return {
        ...(code ? { code } : {}),
        ...(message ? { message } : {}),
        statusCode: statusCode ?? HttpStatus.InternalServerError
    };
};

const getErrorMessage = (error: NormalizedError): string => {
    if (error.statusCode >= HttpStatus.InternalServerError && error.code === ErrorCodes.INTERNAL_SERVER_ERROR) {
        return 'Internal Server Error';
    }

    return error.message ?? error.code ?? 'Internal Server Error';
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
