import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(AI_TOKENS.CreateAIConversationUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
