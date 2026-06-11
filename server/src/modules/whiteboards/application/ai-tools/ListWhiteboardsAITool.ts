import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import { ListWhiteboardsUseCase } from '@modules/whiteboards/application/use-cases/ListWhiteboardsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class ListWhiteboardsAITool extends AITool {
    readonly name = 'list_whiteboards';
    readonly description = 'List all whiteboards in the team.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        folderId: z.string().optional()
    });

    constructor(
        protected readonly useCase: ListWhiteboardsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            folderId: params.folderId
        });
        if (!result.success) throw result.error;
        return { summary: `Found ${result.value.total} whiteboards.`, data: result.value.data };
    }
}
