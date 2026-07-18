import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { TrajectoryPreviewResult } from '@modules/trajectory/contracts/trajectory';
import type { Response } from 'express';

export const sendTrajectoryPreview = (
    res: Response,
    value: TrajectoryPreviewResult
): void => {
    const request = res.req;

    if (request.headers['if-none-match'] === value.etag) {
        res.status(304).send();
        return;
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('ETag', value.etag);
    BaseResponse.success(res, value.base64);
};

export const sendTrajectoryPreviewError = (res: Response, error: unknown): void => {
    BaseResponse.fromError(res, error);
};
