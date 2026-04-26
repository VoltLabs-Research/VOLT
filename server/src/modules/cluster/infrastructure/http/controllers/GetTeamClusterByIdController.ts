import GetTeamClusterByIdUseCase from '@modules/cluster/application/use-cases/GetTeamClusterByIdUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(GetTeamClusterByIdUseCase);
