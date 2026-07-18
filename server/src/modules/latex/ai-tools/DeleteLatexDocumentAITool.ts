import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({ documentId: z.string() });
type Params = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteLatexDocumentAITool extends AITool<Params> {
    readonly name = 'delete_latex_document';
    readonly description = 'Delete a LaTeX document.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        return this.#service.deleteDocument({ teamId: scope.teamId, userId: scope.userId, documentId: params.documentId });
    }
}
