import CreateAIConversationUseCase from '@modules/ai/application/use-cases/CreateAIConversationUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(CreateAIConversationUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
