import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type SendAIConversationMessageUseCase from '@modules/ai/application/use-cases/SendAIConversationMessageUseCase';
import type { UseCaseOutput } from '@shared/application/IUseCase';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

type SendAIConversationMessageOutput = UseCaseOutput<SendAIConversationMessageUseCase>;

export default createController<SendAIConversationMessageUseCase>(AI_TOKENS.SendAIConversationMessageUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    }),
    handleSuccess: async (_req, res, value: SendAIConversationMessageOutput) => {
        const [fullText, assistantMessage] = await Promise.all([
            value.streamResult.consumeText(),
            value.assistantMessage
        ]);

        BaseResponse.success(res, {
            text: fullText,
            userMessage: value.userMessage,
            assistantMessage
        }, HttpStatus.Created);
    }
});
