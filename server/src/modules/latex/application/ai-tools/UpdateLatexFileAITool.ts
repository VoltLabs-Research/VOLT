import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { UpdateLatexFileUseCase } from '@modules/latex/application/use-cases/UpdateLatexFileUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class UpdateLatexFileAITool extends AITool {
    readonly name = 'update_latex_file';
    readonly description = 'Update a source file inside a LaTeX document.';
    readonly parameters = z.object({
        documentId: z.string(),
        fileId: z.string(),
        name: z.string().optional(),
        path: z.string().optional(),
        content: z.string().optional()
    });

    constructor(
        protected readonly useCase: UpdateLatexFileUseCase
    ) {
        super();
    }
}
