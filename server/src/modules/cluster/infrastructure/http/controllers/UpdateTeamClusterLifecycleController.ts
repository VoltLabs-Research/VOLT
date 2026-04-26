import UpdateTeamClusterLifecycleUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterLifecycleUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(UpdateTeamClusterLifecycleUseCase);
