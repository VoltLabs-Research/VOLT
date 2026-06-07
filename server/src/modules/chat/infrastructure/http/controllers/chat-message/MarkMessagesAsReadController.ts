import { createController } from '@shared/infrastructure/http/controllers/createController';
import { MarkMessageAsReadUseCase } from '@modules/chat/application/use-cases/chat-message/MarkMessageAsReadUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

const MarkMessagesAsReadController = createController(MarkMessageAsReadUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default MarkMessagesAsReadController;
