import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import type { LatexFileView } from '@volt/contracts/modules/latex/domain';
import { z } from 'zod';

const parameters = z.object({
    documentId: z.string(),
    fileId: z.string(),
    name: z.string().optional(),
    path: z.string().optional(),
    content: z.string().optional()
});

type UpdateLatexFileParams = z.infer<typeof parameters>;

export class UpdateLatexFileAITool extends AITool<UpdateLatexFileParams, LatexFileView> {
    readonly name = 'update_latex_file';
    readonly description = 'Update a source file inside a LaTeX document.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: UpdateLatexFileParams, scope: AIToolScope): Promise<LatexFileView> {
        return this.#service.updateFile({ teamId: scope.teamId, ...params, source: 'ai' });
    }
}
