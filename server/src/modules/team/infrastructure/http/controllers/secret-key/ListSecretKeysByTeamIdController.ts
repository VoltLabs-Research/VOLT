import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import ListSecretKeysByTeamIdUseCase from '@modules/team/application/use-cases/secret-key/ListSecretKeysByTeamIdUseCase';

const ListSecretKeysByTeamIdController = createPaginatedController(ListSecretKeysByTeamIdUseCase);
export default ListSecretKeysByTeamIdController;
