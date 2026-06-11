import SendAIConversationMessageUseCase from '@modules/ai/application/use-cases/SendAIConversationMessageUseCase';
import type { UseCaseOutput } from '@shared/application/IUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

type SendAIConversationMessageOutput = UseCaseOutput<SendAIConversationMessageUseCase>;

export default createController<SendAIConversationMessageUseCase>(SendAIConversationMessageUseCase, {
    handleSuccess: async (_req, res, value: SendAIConversationMessageOutput) => {
        value.streamResult.pipeToResponse(res);
    }
});
