import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    title: z.string(),
    folderId: z.string().nullable().optional()
});
type Params = z.infer<typeof parameters>;

export class CreateLatexDocumentAITool extends AITool<Params> {
    readonly name = 'create_latex_document';
    readonly description = 'Create a new LaTeX document.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        return this.#service.createDocument({ teamId: scope.teamId, userId: scope.userId, ...params });
    }
}
