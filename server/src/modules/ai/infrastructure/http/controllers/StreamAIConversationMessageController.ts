import SendAIConversationMessageUseCase from '@modules/ai/application/use-cases/SendAIConversationMessageUseCase';
import type { UseCaseOutput } from '@shared/application/IUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

type SendAIConversationMessageOutput = UseCaseOutput<SendAIConversationMessageUseCase>;

export default createController<SendAIConversationMessageUseCase>(SendAIConversationMessageUseCase, {
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    }),
    handleSuccess: async (_req, res, value: SendAIConversationMessageOutput) => {
        value.streamResult.pipeToResponse(res);
    }
});
