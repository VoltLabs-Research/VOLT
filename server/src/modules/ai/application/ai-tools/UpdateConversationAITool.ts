import type { AIToolScope } from '@modules/ai/services/AIToolService';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import UpdateAIConversationUseCase from '@modules/ai/application/use-cases/UpdateAIConversationUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { inject, injectable } from 'tsyringe';
import { z } from 'zod';

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
};
