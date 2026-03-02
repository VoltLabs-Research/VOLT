import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import ListAIConversationsUseCase from '@modules/ai/application/use-cases/ListAIConversationsUseCase';

@injectable()
export class ListConversationsAITool extends AITool {
    readonly name = 'list_conversations';
    readonly description = 'List all AI conversations for the current user.';
    readonly parameters = z.object({ page: z.number().optional().default(1), limit: z.number().optional().default(50) });

    constructor(
        @inject(ListAIConversationsUseCase)
        protected readonly useCase: ListAIConversationsUseCase
    ) {
        super();
    }
}
