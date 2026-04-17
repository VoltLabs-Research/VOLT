import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { z } from 'zod';

const listAIConversationMessagesRequestSchema = z.object({
    teamId: z.string().min(1),
    conversationId: z.string().min(1),
    userId: z.string().min(1),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional()
});

export default createPaginatedController(AI_TOKENS.ListAIConversationMessagesUseCase, {
    validationSchema: {
        params: listAIConversationMessagesRequestSchema.pick({ teamId: true, conversationId: true }),
        query: listAIConversationMessagesRequestSchema.pick({ page: true, limit: true }),
        request: listAIConversationMessagesRequestSchema.pick({ userId: true })
    }
});
