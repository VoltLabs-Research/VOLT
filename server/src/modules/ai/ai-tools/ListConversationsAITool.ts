import AiService from '@modules/ai/services/AiService';
import { AI_TOKENS } from '@modules/ai/di/AITokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class ListConversationsAITool extends AITool {
    readonly name = 'list_conversations';
    readonly description = 'List all AI conversations for the current user.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50)
    });

    #service = new AiService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.#service.listConversations({
            teamId: scope.teamId,
            userId: scope.userId,
            page: params.page,
            limit: params.limit
        });
        return {
            summary: `Found ${result.total} conversations.`,
            data: result.data,
            total: result.total
        };
    }
}
