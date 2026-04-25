import { ErrorCodes } from '@core/constants/error-codes';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import type { Response } from 'express';

export const sendTrajectoryPreview = (
    res: Response,
    value: GetTrajectoryPreviewOutputDTO
): void => {
    const request = res.req;

    if (request?.headers['if-none-match'] === value.etag) {
        res.status(304).send();
        return;
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('ETag', value.etag);
    BaseResponse.success(res, value.base64);
};

export const sendTrajectoryPreviewError = (res: Response): void => {
    BaseResponse.error(
        res,
        'Failed to retrieve trajectory preview',
        500,
        ErrorCodes.INTERNAL_SERVER_ERROR
    );
};
