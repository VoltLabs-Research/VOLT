import { analysisValidation } from '@modules/analysis/infrastructure/http/validation/analysis-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetAnalysisFrameLogUseCase from '@modules/analysis/application/use-cases/GetAnalysisFrameLogUseCase';

export default createController(GetAnalysisFrameLogUseCase, {
    validationSchema: analysisValidation.getFrameLog
});
