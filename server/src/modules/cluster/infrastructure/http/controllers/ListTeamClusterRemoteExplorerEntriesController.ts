import ListTeamClusterRemoteExplorerEntriesUseCase from '@modules/cluster/application/use-cases/ListTeamClusterRemoteExplorerEntriesUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(ListTeamClusterRemoteExplorerEntriesUseCase);
