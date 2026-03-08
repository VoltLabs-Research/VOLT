import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateGroupAdminsUseCase } from '@modules/chat/application/use-cases/chat/UpdateGroupAdminsUseCase';

const UpdateGroupAdminsController = createController(UpdateGroupAdminsUseCase);
export default UpdateGroupAdminsController;
