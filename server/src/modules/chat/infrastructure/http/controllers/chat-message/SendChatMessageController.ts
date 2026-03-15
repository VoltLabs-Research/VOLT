import { createController } from '@shared/infrastructure/http/controllers/createController';
import { SendChatMessageUseCase } from '@modules/chat/application/use-cases/chat-message/SendChatMessageUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

const SendChatMessageController = createController(SendChatMessageUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default SendChatMessageController;
