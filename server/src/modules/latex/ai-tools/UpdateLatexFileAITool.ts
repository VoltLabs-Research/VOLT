import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { UpdateLatexFileUseCase } from '@modules/latex/use-cases/UpdateLatexFileUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import type { UpdateLatexFileOutputDTO } from '@modules/latex/dtos/UpdateLatexFileDTO';
import { z } from 'zod';

const parameters = z.object({
    documentId: z.string(),
    fileId: z.string(),
    name: z.string().optional(),
    path: z.string().optional(),
    content: z.string().optional()
});

type UpdateLatexFileParams = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class UpdateLatexFileAITool extends AITool<UpdateLatexFileParams, UpdateLatexFileOutputDTO> {
    readonly name = 'update_latex_file';
    readonly description = 'Update a source file inside a LaTeX document.';
    readonly parameters = parameters;

    constructor(
        protected readonly useCase: UpdateLatexFileUseCase
    ) {
        super();
    }

    /**
     * Tags the write with `source: 'ai'` (server-controlled, kept out of the
     * model-facing schema) so the use-case broadcasts the new content into any
     * open editing session — letting the edit appear live in open editors.
     */
    async execute(params: UpdateLatexFileParams, scope: AIToolScope): Promise<UpdateLatexFileOutputDTO> {
        return this.useCase.execute({ ...params, ...scope, source: 'ai' });
    }
}
