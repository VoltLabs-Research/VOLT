import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { SetLatexFileEntrypointUseCase } from '@modules/latex/application/use-cases/SetLatexFileEntrypointUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
