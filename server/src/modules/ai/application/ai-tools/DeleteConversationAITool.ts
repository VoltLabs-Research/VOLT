import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import DeleteAIConversationUseCase from '@modules/ai/application/use-cases/DeleteAIConversationUseCase';
import { AI_TOKENS } from '@modules/ai/application/di/AITokens';

@injectable()
export class DeleteConversationAITool extends AITool {
    readonly name = 'delete_conversation';
    readonly description = 'Delete an AI conversation.';
    readonly parameters = z.object({
        conversationId: z.string()
    });
    protected needsApproval = true;

    constructor(
        @inject(AI_TOKENS.DeleteAIConversationUseCase)
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
}
