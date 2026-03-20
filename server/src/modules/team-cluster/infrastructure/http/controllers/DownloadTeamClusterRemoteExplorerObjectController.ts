import DownloadTeamClusterRemoteExplorerObjectUseCase from '@modules/team-cluster/application/use-cases/DownloadTeamClusterRemoteExplorerObjectUseCase';
import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';

export default createPreparedDownloadStreamController(DownloadTeamClusterRemoteExplorerObjectUseCase, {
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
