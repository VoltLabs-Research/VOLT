import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { CompileLatexDocumentUseCase } from '@modules/latex/application/use-cases/CompileLatexDocumentUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class CompileLatexDocumentAITool extends AITool {
    readonly name = 'compile_latex_document';
    readonly description = 'Compile a LaTeX document into a PDF.';
    readonly parameters = z.object({ documentId: z.string() });

    constructor(
        protected readonly useCase: CompileLatexDocumentUseCase
    ) {
        super();
    }
}
