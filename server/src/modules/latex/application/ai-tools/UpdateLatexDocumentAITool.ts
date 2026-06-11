import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { UpdateLatexDocumentUseCase } from '@modules/latex/application/use-cases/UpdateLatexDocumentUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class UpdateLatexDocumentAITool extends AITool {
    readonly name = 'update_latex_document';
    readonly description = 'Update a LaTeX document.';
    readonly parameters = z.object({
        documentId: z.string(),
        title: z.string().optional()
    });

    constructor(
        protected readonly useCase: UpdateLatexDocumentUseCase
    ) {
        super();
    }
}
