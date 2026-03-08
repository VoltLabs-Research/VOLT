import { analysisValidation } from '@modules/analysis/infrastructure/http/validation/analysis-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetAnalysisByIdUseCase from '@modules/analysis/application/use-cases/GetAnalysisByIdUseCase';

export default createController(GetAnalysisByIdUseCase, {
    validationSchema: analysisValidation.getById
});
