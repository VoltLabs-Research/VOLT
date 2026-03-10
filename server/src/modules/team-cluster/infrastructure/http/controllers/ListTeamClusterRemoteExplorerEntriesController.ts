import ListTeamClusterRemoteExplorerEntriesUseCase from '@modules/team-cluster/application/use-cases/ListTeamClusterRemoteExplorerEntriesUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(ListTeamClusterRemoteExplorerEntriesUseCase, {
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
