import { createController } from '@shared/infrastructure/http/controllers/createController';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(AI_TOKENS.UpdateAIConversationUseCase, {
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
