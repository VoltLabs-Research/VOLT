import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteMessageUseCase } from '@modules/chat/application/use-cases/chat-message/DeleteMessageUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

const DeleteMessageController = createController(DeleteMessageUseCase, HttpStatus.NoContent);
export default DeleteMessageController;
