import type { ErrorRequestHandler } from 'express';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

export const httpErrorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
    logger.error(error);

    if (response.headersSent) {
        return;
    }

    BaseResponse.fromError(response, error);
};
