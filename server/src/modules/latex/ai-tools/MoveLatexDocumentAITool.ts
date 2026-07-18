import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { MoveLatexDocumentUseCase } from '@modules/latex/use-cases/MoveLatexDocumentUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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
