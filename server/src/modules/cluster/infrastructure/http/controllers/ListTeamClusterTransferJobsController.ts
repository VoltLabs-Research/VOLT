import ListTeamClusterTransferJobsUseCase from '@modules/cluster/application/use-cases/ListTeamClusterTransferJobsUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';

export default createPaginatedController(ListTeamClusterTransferJobsUseCase);
