import CreateTeamClusterTransferRequestUseCase from '@modules/team-cluster/application/use-cases/CreateTeamClusterTransferRequestUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CreateTeamClusterTransferRequestUseCase);
