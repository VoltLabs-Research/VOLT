import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({ documentId: z.string() });
type Params = z.infer<typeof parameters>;

export class CompileLatexDocumentAITool extends AITool<Params> {
    readonly name = 'compile_latex_document';
    readonly description = 'Compile a LaTeX document into a PDF.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        return this.#service.compileDocument({ teamId: scope.teamId, documentId: params.documentId });
    }
}
