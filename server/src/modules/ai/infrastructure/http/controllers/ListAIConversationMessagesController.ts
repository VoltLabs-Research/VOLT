import ListAIConversationMessagesUseCase from '@modules/ai/application/use-cases/ListAIConversationMessagesUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';

export default createPaginatedController(ListAIConversationMessagesUseCase, {
});
