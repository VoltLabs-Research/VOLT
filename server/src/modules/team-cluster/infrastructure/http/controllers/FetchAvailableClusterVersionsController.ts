import FetchAvailableClusterVersionsUseCase from '@modules/team-cluster/application/use-cases/FetchAvailableClusterVersionsUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(FetchAvailableClusterVersionsUseCase);
