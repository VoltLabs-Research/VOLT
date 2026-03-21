import UpdateTeamClusterQueueConcurrencyUseCase from '@modules/team-cluster/application/use-cases/UpdateTeamClusterQueueConcurrencyUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(UpdateTeamClusterQueueConcurrencyUseCase);
