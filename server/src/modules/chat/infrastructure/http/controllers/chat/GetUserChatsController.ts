import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetUserChatsUseCase } from '@modules/chat/application/use-cases/chat/GetUserChatsUseCase';

const GetUserChatsController = createController(GetUserChatsUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default GetUserChatsController;
