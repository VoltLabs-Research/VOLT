import AiService from '@modules/ai/services/AiService';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

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
