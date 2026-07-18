import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { DeleteLatexDocumentUseCase } from '@modules/latex/use-cases/DeleteLatexDocumentUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteLatexDocumentAITool extends AITool {
    readonly name = 'delete_latex_document';
    readonly description = 'Delete a LaTeX document.';
    readonly parameters = z.object({ documentId: z.string() });

    constructor(
        protected readonly useCase: DeleteLatexDocumentUseCase
    ) {
        super();
    }
}
