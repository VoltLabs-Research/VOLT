import UpdateAIConversationUseCase from '@modules/ai/application/use-cases/UpdateAIConversationUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(UpdateAIConversationUseCase, {
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
