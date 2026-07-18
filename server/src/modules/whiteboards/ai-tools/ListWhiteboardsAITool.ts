import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { ListWhiteboardsUseCase } from '@modules/whiteboards/use-cases/ListWhiteboardsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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
        const value = await this.useCase.execute({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            folderId: params.folderId
        });
        return { summary: `Found ${value.total} whiteboards.`, data: value.data };
    }
}
