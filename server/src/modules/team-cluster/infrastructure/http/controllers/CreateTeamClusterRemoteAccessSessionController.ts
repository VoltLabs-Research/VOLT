import CreateTeamClusterRemoteAccessSessionUseCase from '@modules/team-cluster/application/use-cases/CreateTeamClusterRemoteAccessSessionUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CreateTeamClusterRemoteAccessSessionUseCase, {
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
