import { createController } from '@shared/infrastructure/http/controllers/createController';
import ListUserTeamsUseCase from '@modules/team/application/use-cases/team/ListUserTeamsUseCase';

const ListUserTeamsController = createController(ListUserTeamsUseCase);
export default ListUserTeamsController;
