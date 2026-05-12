import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import ListPublicTeamTrajectoriesUseCase from '@modules/trajectory/application/use-cases/trajectory/ListPublicTeamTrajectoriesUseCase';

const ListPublicTeamTrajectoriesController = createPaginatedController(ListPublicTeamTrajectoriesUseCase);

export default {
    listPublicTeamTrajectories: new ListPublicTeamTrajectoriesController()
};
