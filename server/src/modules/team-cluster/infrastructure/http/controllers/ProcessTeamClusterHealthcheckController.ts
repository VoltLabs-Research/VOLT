import ProcessTeamClusterHealthcheckUseCase from '@modules/team-cluster/application/use-cases/ProcessTeamClusterHealthcheckUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(ProcessTeamClusterHealthcheckUseCase);
