import UpdateAIConversationUseCase from '@modules/ai/application/use-cases/UpdateAIConversationUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(UpdateAIConversationUseCase);
