import logger from '@shared/infrastructure/logger';
import { runWithHttpRequestContext } from '@shared/infrastructure/http/request-context';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './authentication';
import type { HttpRequestContext } from '@shared/infrastructure/http/request-context';

export const TRACE_ID_HEADER = 'x-trace-id';

const getTraceIdHeader = (request: AuthenticatedRequest): string | null => {
    const traceIdHeader = request.headers[TRACE_ID_HEADER];

    if (Array.isArray(traceIdHeader)) {
        return traceIdHeader[0]?.trim() || null;
    }

    if (typeof traceIdHeader === 'string' && traceIdHeader.trim()) {
        return traceIdHeader.trim();
    }

    return null;
};

const getRequestPath = (request: AuthenticatedRequest): string => {
    return request.originalUrl || request.url || request.path;
};

const logHttpRequest = (
    request: AuthenticatedRequest,
    response: Response,
    context: HttpRequestContext
): void => {
    logger.info(`@http-request traceId=${context.traceId} method=${request.method} path=${context.path} statusCode=${response.statusCode}`);
};

export const requestContextMiddleware = (
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction
): void => {
    const traceId = getTraceIdHeader(request) || randomUUID();
    const context: HttpRequestContext = {
        traceId,
        startedAt: Date.now(),
        method: request.method,
        path: getRequestPath(request)
    };

    request.requestContext = context;
    response.setHeader(TRACE_ID_HEADER, traceId);
    response.on('finish', () => {
        logHttpRequest(request, response, context);
    });

    runWithHttpRequestContext(context, () => {
        next();
    });
};
