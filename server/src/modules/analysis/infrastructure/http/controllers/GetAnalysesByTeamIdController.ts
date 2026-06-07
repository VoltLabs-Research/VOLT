import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import GetAnalysesByTeamIdUseCase from '@modules/analysis/application/use-cases/GetAnalysesByTeamIdUseCase';

export default createPaginatedController(GetAnalysesByTeamIdUseCase, {
});
