import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetMyTeamPermissionsUseCase from '@modules/team/application/use-cases/team/GetMyTeamPermissionsUseCase';

const GetMyTeamPermissionsController = createController(GetMyTeamPermissionsUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default GetMyTeamPermissionsController;
