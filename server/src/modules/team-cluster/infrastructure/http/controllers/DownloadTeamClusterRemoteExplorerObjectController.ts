import DownloadTeamClusterRemoteExplorerObjectUseCase from '@modules/team-cluster/application/use-cases/DownloadTeamClusterRemoteExplorerObjectUseCase';
import { createStreamController } from '@shared/infrastructure/http/controllers/createController';

export default createStreamController(DownloadTeamClusterRemoteExplorerObjectUseCase, {
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ],
    getHeaders: (resultValue) => resultValue.headers,
    prepareOutput: async (resultValue) => {
        await resultValue.prepare?.();
    }
});
