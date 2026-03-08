import { analysisValidation } from '@modules/analysis/infrastructure/http/validation/analysis-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import RetryFailedFramesUseCase from '@modules/analysis/application/use-cases/RetryFailedFramesUseCase';

export default createController(RetryFailedFramesUseCase, {
    validationSchema: analysisValidation.retryFailedFrames
});
