import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { SendFileMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendFileMessageUseCase';

const SendFileMessageController = createController(SendFileMessageUseCase, HttpStatus.Created);
export default SendFileMessageController;
