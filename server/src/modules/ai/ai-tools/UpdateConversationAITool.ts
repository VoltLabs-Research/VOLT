import AiService from '@modules/ai/services/AiService';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class UpdateConversationAITool extends AITool {
    readonly name = 'update_conversation';
    readonly description = 'Update an AI conversation title.';
    readonly parameters = z.object({
        conversationId: z.string(),
        title: z.string().optional()
    });

    #service = new AiService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.updateConversation({
            conversationId: params.conversationId,
            title: params.title,
            teamId: scope.teamId,
            userId: scope.userId
        });
    }
}
