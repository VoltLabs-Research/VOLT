import ListTeamClusterTransferJobsUseCase from '@modules/team-cluster/application/use-cases/ListTeamClusterTransferJobsUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';

export default createPaginatedController(ListTeamClusterTransferJobsUseCase);
