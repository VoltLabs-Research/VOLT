import DeleteAIConversationUseCase from '@modules/ai/application/use-cases/DeleteAIConversationUseCase';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
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

    constructor(
        
        protected readonly useCase: DeleteAIConversationUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            conversationId: params.conversationId,
            teamId: scope.teamId,
            userId: scope.userId
        });
        if (!result.success) throw result.error;
        return { deleted: true };
    }
};
