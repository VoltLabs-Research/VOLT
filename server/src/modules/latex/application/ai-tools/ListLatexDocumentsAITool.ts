import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { ListLatexDocumentsUseCase } from '@modules/latex/application/use-cases/ListLatexDocumentsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListLatexDocumentsAITool extends AITool {
    readonly name = 'list_latex_documents';
    readonly description = 'List LaTeX documents in the team.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        search: z.string().optional(),
        folderId: z.string().optional()
    });

    constructor(
        protected readonly useCase: ListLatexDocumentsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            search: params.search,
            folderId: params.folderId
        });
        return { summary: `Found ${result.total} LaTeX documents.`, data: result.data };
    }
}
