import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import type { Response } from 'express';

export const sendTrajectoryPreview = (
    res: Response,
    value: GetTrajectoryPreviewOutputDTO
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

// Why: the createController escape hatch passes the thrown error here. Hard-coding
// 500 flattened recoverable failures (e.g. 409 daemon-not-connected, 404 missing
// object) into opaque server errors; normalize so each error keeps its real status.
export const sendTrajectoryPreviewError = (res: Response, error: unknown): void => {
    BaseResponse.fromError(res, error);
};
