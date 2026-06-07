import ListAIConversationsUseCase from '@modules/ai/application/use-cases/ListAIConversationsUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';

export default createPaginatedController(ListAIConversationsUseCase, {
});
