import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createPaginatedController(AI_TOKENS.ListAIConversationMessagesUseCase, {
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
