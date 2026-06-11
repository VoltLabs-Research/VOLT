import DeleteAIConversationUseCase from '@modules/ai/application/use-cases/DeleteAIConversationUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(DeleteAIConversationUseCase, {
    statusCode: HttpStatus.NoContent
});
