import { createController } from '@shared/infrastructure/http/controllers/createController';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';

export default createController(AI_TOKENS.UpdateAIConversationUseCase);
