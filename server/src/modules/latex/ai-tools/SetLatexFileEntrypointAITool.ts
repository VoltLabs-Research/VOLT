import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { SetLatexFileEntrypointUseCase } from '@modules/latex/use-cases/SetLatexFileEntrypointUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class SetLatexFileEntrypointAITool extends AITool {
    readonly name = 'set_latex_file_entrypoint';
    readonly description = 'Set a source file as the compilation entrypoint of a LaTeX document.';
    readonly parameters = z.object({
        documentId: z.string(),
        fileId: z.string()
    });

    constructor(
        protected readonly useCase: SetLatexFileEntrypointUseCase
    ) {
        super();
    }
}
