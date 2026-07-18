import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { CreateLatexFileUseCase } from '@modules/latex/use-cases/CreateLatexFileUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class CreateLatexFileAITool extends AITool {
    readonly name = 'create_latex_file';
    readonly description = 'Create a new source file inside a LaTeX document.';
    readonly parameters = z.object({
        documentId: z.string(),
        name: z.string(),
        path: z.string().optional(),
        content: z.string().optional(),
        isEntrypoint: z.boolean().optional()
    });

    constructor(
        protected readonly useCase: CreateLatexFileUseCase
    ) {
        super();
    }
}
