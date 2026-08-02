import { logger } from '@shared/infrastructure/logger';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { Response } from 'express';

/** Errors raised by express middleware (body-parser) carry their own status. */
interface StatusCodeError extends Error {
    code?: string;
    statusCode: number;
}

export const writeJson = (response: Response, statusCode: number, payload: object): void => {
    const body = Buffer.from(JSON.stringify(payload));
    response.status(statusCode);
    response.setHeader('content-type', 'application/json');
    response.setHeader('content-length', body.length);
    response.end(body);
};

export const writeRequestFailure = (response: Response, error: Error): void => {
    if (response.headersSent) {
        response.destroy(error);
        return;
    }

    if (error instanceof ApplicationError) {
        writeJson(response, error.statusCode, {
            code: error.code,
            message: error.message
        });
        return;
    }

    const statusCodeError = error as Partial<StatusCodeError>;
    if (statusCodeError.statusCode !== undefined) {
        writeJson(response, statusCodeError.statusCode, {
            code: statusCodeError.code,
            message: error.message
        });
        return;
    }

    logger.error(`Object gateway request failed: ${error.message}`);
    writeJson(response, 500, {
        message: 'Object gateway request failed'
    });
};
