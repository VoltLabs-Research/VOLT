import UpdateTeamClusterRoleUseCase from '@modules/team-cluster/application/use-cases/UpdateTeamClusterRoleUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(UpdateTeamClusterRoleUseCase);
