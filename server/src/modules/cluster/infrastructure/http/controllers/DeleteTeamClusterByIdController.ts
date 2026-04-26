import DeleteTeamClusterByIdUseCase from '@modules/cluster/application/use-cases/DeleteTeamClusterByIdUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(DeleteTeamClusterByIdUseCase);
