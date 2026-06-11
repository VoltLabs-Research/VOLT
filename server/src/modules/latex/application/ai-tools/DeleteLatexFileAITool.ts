import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { DeleteLatexFileUseCase } from '@modules/latex/application/use-cases/DeleteLatexFileUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
