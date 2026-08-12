import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';

import type { TrajectoryPreviewResult } from '@modules/trajectory/services/TrajectoryServiceTypes';
import type { Response } from 'express';

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
