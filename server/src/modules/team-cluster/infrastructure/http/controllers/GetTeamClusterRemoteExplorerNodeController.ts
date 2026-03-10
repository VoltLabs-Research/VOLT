import GetTeamClusterRemoteExplorerNodeUseCase from '@modules/team-cluster/application/use-cases/GetTeamClusterRemoteExplorerNodeUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(GetTeamClusterRemoteExplorerNodeUseCase, {
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
