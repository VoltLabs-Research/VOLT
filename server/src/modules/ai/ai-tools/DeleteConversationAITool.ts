import AiService from '@modules/ai/services/AiService';
import { AI_TOKENS } from '@modules/ai/di/AITokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class DeleteConversationAITool extends AITool {
    readonly name = 'delete_conversation';
    readonly description = 'Delete an AI conversation.';
    readonly parameters = z.object({
        conversationId: z.string()
    });

    #service = new AiService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        await this.#service.deleteConversation({
            conversationId: params.conversationId,
            teamId: scope.teamId,
            userId: scope.userId
        });
        return { deleted: true };
    }
}
