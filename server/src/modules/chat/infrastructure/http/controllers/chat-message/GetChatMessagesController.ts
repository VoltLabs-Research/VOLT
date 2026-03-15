import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetChatMessagesUseCase } from '@modules/chat/application/use-cases/chat-message/GetChatMessagesUseCase';

const GetChatMessagesController = createController(GetChatMessagesUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default GetChatMessagesController;
