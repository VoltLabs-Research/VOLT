import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetChatMessagesUseCase } from '@modules/chat/application/use-cases/chat-message/GetChatMessagesUseCase';

const GetChatMessagesController = createController(GetChatMessagesUseCase);
export default GetChatMessagesController;
