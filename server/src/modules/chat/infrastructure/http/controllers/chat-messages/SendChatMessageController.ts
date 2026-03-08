import { createController } from '@shared/infrastructure/http/controllers/createController';
import { SendChatMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendChatMessageUseCase';

const SendChatMessageController = createController(SendChatMessageUseCase);
export default SendChatMessageController;
