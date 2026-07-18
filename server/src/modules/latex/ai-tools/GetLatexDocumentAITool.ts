import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({ documentId: z.string() });
type Params = z.infer<typeof parameters>;

export class GetLatexDocumentAITool extends AITool<Params> {
    readonly name = 'get_latex_document';
    readonly description = 'Get detailed information about a specific LaTeX document.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        const result = await this.#service.getDocument({ teamId: scope.teamId, documentId: params.documentId });
        return { summary: `Retrieved LaTeX document "${result.title}".`, data: result };
    }
}
