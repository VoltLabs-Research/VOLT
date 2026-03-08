import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';

export default createPaginatedController(AI_TOKENS.ListAIConversationsUseCase);
