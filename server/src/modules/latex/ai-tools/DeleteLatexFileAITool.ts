import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { DeleteLatexFileUseCase } from '@modules/latex/use-cases/DeleteLatexFileUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteLatexFileAITool extends AITool {
    readonly name = 'delete_latex_file';
    readonly description = 'Delete a source file from a LaTeX document.';
    readonly parameters = z.object({
        documentId: z.string(),
        fileId: z.string()
    });

    constructor(
        protected readonly useCase: DeleteLatexFileUseCase
    ) {
        super();
    }
}
