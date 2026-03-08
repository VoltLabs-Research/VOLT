import { ErrorCodes } from '@core/constants/error-codes';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetTrajectoryPreviewUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryPreviewUseCase';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';

import type { UseCaseOutput } from '@shared/application/IUseCase';

type GetTrajectoryPreviewOutput = UseCaseOutput<GetTrajectoryPreviewUseCase>;

export default createController(GetTrajectoryPreviewUseCase, {
    handleSuccess: (res, value: GetTrajectoryPreviewOutput) => {
        const request = res.req;

        if (request?.headers['if-none-match'] === value.etag) {
            res.status(304).send();
            return;
        }

        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('ETag', value.etag);
        BaseResponse.success(res, value.base64);
    },
    handleUnexpectedError: (res) => {
        BaseResponse.error(res, 'Failed to retrieve trajectory preview', 500, ErrorCodes.INTERNAL_SERVER_ERROR);
    }
});
