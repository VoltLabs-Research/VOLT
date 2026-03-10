import DeleteTeamClusterByIdUseCase from '@modules/team-cluster/application/use-cases/DeleteTeamClusterByIdUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(DeleteTeamClusterByIdUseCase, {
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
