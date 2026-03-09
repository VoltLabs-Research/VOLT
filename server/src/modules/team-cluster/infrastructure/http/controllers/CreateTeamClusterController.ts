import CreateTeamClusterUseCase from '@modules/team-cluster/application/use-cases/CreateTeamClusterUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CreateTeamClusterUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId ?? ''
    })
});
