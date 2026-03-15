import { createController } from '@shared/infrastructure/http/controllers/createController';
import ListUserTeamsUseCase from '@modules/team/application/use-cases/team/ListUserTeamsUseCase';

const ListUserTeamsController = createController(ListUserTeamsUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default ListUserTeamsController;
