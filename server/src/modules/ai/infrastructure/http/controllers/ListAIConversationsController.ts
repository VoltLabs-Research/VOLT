import ListAIConversationsUseCase from '@modules/ai/application/use-cases/ListAIConversationsUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { z } from 'zod';

const listAIConversationsRequestSchema = z.object({
    teamId: z.string().min(1),
    userId: z.string().min(1),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    includeArchived: z.preprocess((value) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    }, z.boolean().optional())
});

export default createPaginatedController(ListAIConversationsUseCase, {
    validationSchema: {
        params: listAIConversationsRequestSchema.pick({ teamId: true }),
        query: listAIConversationsRequestSchema.pick({ page: true, limit: true, includeArchived: true }),
        request: listAIConversationsRequestSchema.pick({ userId: true })
    }
});
