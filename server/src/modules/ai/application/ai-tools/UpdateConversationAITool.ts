import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import type { AIToolScope } from '@modules/ai/application/services/AIToolService';
import UpdateAIConversationUseCase from '@modules/ai/application/use-cases/UpdateAIConversationUseCase';
import { AI_TOKENS } from '@modules/ai/application/di/AITokens';

@injectable()
export class UpdateConversationAITool extends AITool {
    readonly name = 'update_conversation';
    readonly description = 'Update an AI conversation title.';
    readonly parameters = z.object({
        conversationId: z.string(),
        title: z.string().optional()
    });
    protected needsApproval = true;

    constructor(
        @inject(AI_TOKENS.UpdateAIConversationUseCase)
        protected readonly useCase: UpdateAIConversationUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            conversationId: params.conversationId,
            title: params.title,
            teamId: scope.teamId,
            userId: scope.userId
        });
        if (!result.success) throw result.error;
        return result.value;
    }
}
