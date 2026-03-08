import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { GetAnalysesByTrajectoryIdUseCase } from '@modules/analysis/application/use-cases/GetAnalysesByTrajectoryIdUseCase';
import { analysisValidation } from '@modules/analysis/infrastructure/http/validation/analysis-schemas';

export default createPaginatedController(GetAnalysesByTrajectoryIdUseCase, {
    validationSchema: analysisValidation.listByTrajectoryId
});
