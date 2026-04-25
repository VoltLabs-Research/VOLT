import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetTrajectoryPreviewUseCase from '@modules/trajectory/application/use-cases/trajectory/GetTrajectoryPreviewUseCase';
import {
    sendTrajectoryPreview,
    sendTrajectoryPreviewError
} from '@modules/trajectory/infrastructure/http/controllers/trajectory-preview-response';

import type { UseCaseOutput } from '@shared/application/IUseCase';

type GetTrajectoryPreviewOutput = UseCaseOutput<GetTrajectoryPreviewUseCase>;

export default createController(GetTrajectoryPreviewUseCase, {
    handleSuccess: (_req, res, value: GetTrajectoryPreviewOutput) => {
        sendTrajectoryPreview(res, value);
    },
    handleUnexpectedError: sendTrajectoryPreviewError
});
