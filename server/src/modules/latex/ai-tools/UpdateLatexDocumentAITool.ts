import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    documentId: z.string(),
    title: z.string().optional()
});
type Params = z.infer<typeof parameters>;

export class UpdateLatexDocumentAITool extends AITool<Params> {
    readonly name = 'update_latex_document';
    readonly description = 'Update a LaTeX document.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        return this.#service.updateDocument({ teamId: scope.teamId, userId: scope.userId, ...params });
    }
}
