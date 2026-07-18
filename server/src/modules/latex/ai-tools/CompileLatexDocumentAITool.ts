import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { CompileLatexDocumentUseCase } from '@modules/latex/use-cases/CompileLatexDocumentUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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
