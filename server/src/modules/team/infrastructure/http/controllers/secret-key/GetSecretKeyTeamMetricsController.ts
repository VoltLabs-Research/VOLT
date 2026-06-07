import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetSecretKeyTeamMetricsUseCase from '@modules/team/application/use-cases/secret-key/GetSecretKeyTeamMetricsUseCase';

const GetSecretKeyTeamMetricsController = createController(GetSecretKeyTeamMetricsUseCase, {
});
export default GetSecretKeyTeamMetricsController;
