import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { MoveLatexDocumentUseCase } from '@modules/latex/application/use-cases/MoveLatexDocumentUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class MoveLatexDocumentAITool extends AITool {
    readonly name = 'move_latex_document';
    readonly description = 'Move a LaTeX document to a different folder.';
    readonly parameters = z.object({
        documentId: z.string(),
        folderId: z.string().nullable()
    });

    constructor(
        protected readonly useCase: MoveLatexDocumentUseCase
    ) {
        super();
    }
}
