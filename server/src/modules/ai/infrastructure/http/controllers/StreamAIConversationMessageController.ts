import { createController } from '@shared/infrastructure/http/controllers/createController';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type SendAIConversationMessageUseCase from '@modules/ai/application/use-cases/SendAIConversationMessageUseCase';
import type { UseCaseOutput } from '@shared/application/IUseCase';

type SendAIConversationMessageOutput = UseCaseOutput<SendAIConversationMessageUseCase>;

export default createController<SendAIConversationMessageUseCase>(AI_TOKENS.SendAIConversationMessageUseCase, {
    handleSuccess: async (res, value: SendAIConversationMessageOutput) => {
        value.streamResult.pipeToResponse(res);
    }
});
