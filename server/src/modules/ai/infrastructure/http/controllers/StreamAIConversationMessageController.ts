import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';
import SendAIConversationMessageUseCase from '@modules/ai/application/use-cases/SendAIConversationMessageUseCase';
import type { SendAIConversationMessageInputDTO } from '@modules/ai/application/dtos/SendAIConversationMessageDTO';
import AIUIMessageUtils from '@modules/ai/application/services/AIUIMessageUtils';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class StreamAIConversationMessageController {
    constructor(
        @inject(SendAIConversationMessageUseCase)
        private readonly useCase: SendAIConversationMessageUseCase,

        @inject(AI_TOKENS.AIUIMessageUtils)
        private readonly uiMessageUtils: AIUIMessageUtils
    ) {}

    public handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const messages = this.uiMessageUtils.normalizeUIMessages(req.body?.messages);
        if (!messages) {
            res.status(400).json({
                message: 'UI messages are required',
                code: 'Validation::Missing::Required::Fields'
            });
            return;
        }

        const dto: SendAIConversationMessageInputDTO = {
            teamId: String(req.params.teamId || ''),
            conversationId: String(req.params.conversationId || ''),
            userId: req.userId || '',
            message: this.uiMessageUtils.extractLastUserMessageText(messages),
            messages,
            provider: typeof req.body?.provider === 'string' ? req.body.provider : undefined,
            model: typeof req.body?.model === 'string' ? req.body.model : undefined
        };

        try {
            const result = await this.useCase.execute(dto);
            if (!result.success) {
                res.status(result.error.statusCode || 500).json({
                    message: result.error.message,
                    code: result.error.code
                });
                return;
            }

            result.value.streamResult.pipeUIMessageStreamToResponse(res);
        } catch (error) {
            logger.error(error);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Internal Server Error', code: 'Internal::Server::Error' });
            }
        }
    };
}
