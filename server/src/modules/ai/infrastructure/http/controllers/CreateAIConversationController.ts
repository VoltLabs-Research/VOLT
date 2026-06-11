import CreateAIConversationUseCase from '@modules/ai/application/use-cases/CreateAIConversationUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CreateAIConversationUseCase, {
    statusCode: HttpStatus.Created
});
