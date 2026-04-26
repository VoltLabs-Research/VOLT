import GetTeamClusterRemoteExplorerNodeUseCase from '@modules/cluster/application/use-cases/GetTeamClusterRemoteExplorerNodeUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(GetTeamClusterRemoteExplorerNodeUseCase);
