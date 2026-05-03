import DeleteDemoTeamClusterUseCase from '@modules/cluster/application/use-cases/DeleteDemoTeamClusterUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(DeleteDemoTeamClusterUseCase);
