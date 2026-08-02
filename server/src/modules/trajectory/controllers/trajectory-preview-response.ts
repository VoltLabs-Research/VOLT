import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

import type { TrajectoryPreviewResult } from '@modules/trajectory/services/TrajectoryServiceTypes';
import type { Response } from 'express';

/**
 * Answers a trajectory preview route: 304 while the client's ETag still matches,
 * otherwise the cached base64 thumbnail. A failure becomes an error response
 * unless the headers already went out, in which case there is nothing left to
 * decide and the error is rethrown.
 */
export const respondWithTrajectoryPreview = async (
    res: Response,
    load: () => Promise<TrajectoryPreviewResult>
): Promise<void> => {
    try {
        const value = await load();

        if (res.req.headers['if-none-match'] === value.etag) {
            res.status(304).send();
            return;
        }

        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('ETag', value.etag);
        BaseResponse.success(res, value.base64);
    } catch (error) {
        logger.error(error);

        if (res.headersSent) {
            throw error;
        }

        BaseResponse.fromError(res, error);
    }
};
