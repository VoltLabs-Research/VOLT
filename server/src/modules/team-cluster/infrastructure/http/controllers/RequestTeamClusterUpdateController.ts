import RequestTeamClusterUpdateUseCase from '@modules/team-cluster/application/use-cases/RequestTeamClusterUpdateUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(RequestTeamClusterUpdateUseCase, {
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
