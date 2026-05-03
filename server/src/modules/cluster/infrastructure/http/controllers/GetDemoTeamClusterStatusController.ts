import GetDemoTeamClusterStatusUseCase from '@modules/cluster/application/use-cases/GetDemoTeamClusterStatusUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(GetDemoTeamClusterStatusUseCase);
