import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    documentId: z.string(),
    folderId: z.string().nullable()
});
type Params = z.infer<typeof parameters>;

export class MoveLatexDocumentAITool extends AITool<Params> {
    readonly name = 'move_latex_document';
    readonly description = 'Move a LaTeX document to a different folder.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        return this.#service.moveDocument({ teamId: scope.teamId, documentId: params.documentId, folderId: params.folderId });
    }
}
