import { createController } from '@shared/infrastructure/http/controllers/createController';
import { EditMessageUseCase } from '@modules/chat/application/use-cases/chat-message/EditMessageUseCase';

const EditMessageController = createController(EditMessageUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default EditMessageController;
