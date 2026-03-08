import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import ListAIConversationsUseCase from '@modules/ai/application/use-cases/ListAIConversationsUseCase';
import { AI_TOKENS } from '@modules/ai/application/di/AITokens';

@injectable()
export class ListConversationsAITool extends AITool {
    readonly name = 'list_conversations';
    readonly description = 'List all AI conversations for the current user.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50)
    });

    constructor(
        @inject(AI_TOKENS.ListAIConversationsUseCase)
        protected readonly useCase: ListAIConversationsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            userId: scope.userId,
            page: params.page,
            limit: params.limit
        });
        if (!result.success) throw result.error;
        return {
            summary: `Found ${result.value.total} conversations.`,
            data: result.value.data,
            total: result.value.total
        };
    }
}
