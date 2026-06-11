import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { CreateLatexDocumentUseCase } from '@modules/latex/application/use-cases/CreateLatexDocumentUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
