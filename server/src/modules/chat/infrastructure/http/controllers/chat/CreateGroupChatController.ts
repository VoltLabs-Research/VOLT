import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateGroupChatUseCase } from '@modules/chat/application/use-cases/chat/CreateGroupChatUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

const CreateGroupChatController = createController(CreateGroupChatUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default CreateGroupChatController;
