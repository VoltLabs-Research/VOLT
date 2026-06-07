import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { GetAnalysesByTrajectoryIdUseCase } from '@modules/analysis/application/use-cases/GetAnalysesByTrajectoryIdUseCase';

export default createPaginatedController(GetAnalysesByTrajectoryIdUseCase, {
});
