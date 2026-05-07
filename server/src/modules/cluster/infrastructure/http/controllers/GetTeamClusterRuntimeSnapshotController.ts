import GetTeamClusterRuntimeSnapshotUseCase from '@modules/cluster/application/use-cases/GetTeamClusterRuntimeSnapshotUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(GetTeamClusterRuntimeSnapshotUseCase);
