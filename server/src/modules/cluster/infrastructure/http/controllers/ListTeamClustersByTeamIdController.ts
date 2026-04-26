import ListTeamClustersByTeamIdUseCase from '@modules/cluster/application/use-cases/ListTeamClustersByTeamIdUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';

export default createPaginatedController(ListTeamClustersByTeamIdUseCase);
