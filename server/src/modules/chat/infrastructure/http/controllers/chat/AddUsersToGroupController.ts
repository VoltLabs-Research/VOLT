import { createController } from '@shared/infrastructure/http/controllers/createController';
import { AddUsersToGroupUseCase } from '@modules/chat/application/use-cases/chat/AddUsersToGroupUseCase';

const AddUsersToGroupController = createController(AddUsersToGroupUseCase);
export default AddUsersToGroupController;
