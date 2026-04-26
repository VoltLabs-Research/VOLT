import GetClusterResourceLimitsUseCase from '@modules/cluster/application/use-cases/GetClusterResourceLimitsUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(GetClusterResourceLimitsUseCase);
