import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { GetLatexDocumentUseCase } from '@modules/latex/application/use-cases/GetLatexDocumentUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetLatexDocumentAITool extends AITool {
    readonly name = 'get_latex_document';
    readonly description = 'Get detailed information about a specific LaTeX document.';
    readonly parameters = z.object({ documentId: z.string() });

    constructor(
        protected readonly useCase: GetLatexDocumentUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            documentId: params.documentId
        });
        return { summary: `Retrieved LaTeX document "${result.title}".`, data: result };
    }
}
