import { createController } from '@shared/infrastructure/http/controllers/createController';
import { RemoveUsersFromGroupUseCase } from '@modules/chat/application/use-cases/chat/RemoveUsersFromGroupUseCase';

const RemoveUsersFromGroupController = createController(RemoveUsersFromGroupUseCase);
export default RemoveUsersFromGroupController;
