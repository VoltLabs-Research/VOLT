import UpdateTeamClusterRoleUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterRoleUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(UpdateTeamClusterRoleUseCase);
