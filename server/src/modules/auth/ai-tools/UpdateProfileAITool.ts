import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import UpdateAccountUseCase from '@modules/auth/use-cases/UpdateAccountUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    name: z.string().optional(),
    email: z.string().optional()
});

type UpdateProfileParams = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class UpdateProfileAITool extends AITool<UpdateProfileParams> {
    readonly name = 'update_profile';
    readonly description = 'Update the current user\'s account profile: their display name and/or email address. Only the provided fields are changed.';
    readonly parameters = parameters;
    protected readonly needsApproval = true;

    constructor(
        protected readonly useCase: UpdateAccountUseCase
    ) {
        super();
    }

    async execute(params: UpdateProfileParams, scope: AIToolScope) {
        const value = await this.useCase.execute({
            userId: scope.userId,
            fullName: params.name,
            email: params.email
        });
        return { summary: `Updated profile for ${value.fullName}.`, data: value };
    }
}
