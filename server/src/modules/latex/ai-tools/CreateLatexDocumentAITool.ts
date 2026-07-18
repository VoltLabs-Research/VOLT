import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { CreateLatexDocumentUseCase } from '@modules/latex/use-cases/CreateLatexDocumentUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class CreateLatexDocumentAITool extends AITool {
    readonly name = 'create_latex_document';
    readonly description = 'Create a new LaTeX document.';
    readonly parameters = z.object({
        title: z.string(),
        folderId: z.string().nullable().optional()
    });

    constructor(
        protected readonly useCase: CreateLatexDocumentUseCase
    ) {
        super();
    }
}
