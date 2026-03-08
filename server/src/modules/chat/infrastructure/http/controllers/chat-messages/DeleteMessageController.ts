import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteMessageUseCase } from '@modules/chat/application/use-cases/chat-message/DeleteMessageUseCase';

const DeleteMessageController = createController(DeleteMessageUseCase);
export default DeleteMessageController;
