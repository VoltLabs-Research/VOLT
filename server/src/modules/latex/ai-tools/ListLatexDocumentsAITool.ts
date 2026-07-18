import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50),
    search: z.string().optional(),
    folderId: z.string().optional()
});
type Params = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListLatexDocumentsAITool extends AITool<Params> {
    readonly name = 'list_latex_documents';
    readonly description = 'List LaTeX documents in the team.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        const result = await this.#service.listDocuments({
            teamId: scope.teamId,
            page: params.page,
            limit: params.limit,
            search: params.search,
            folderId: params.folderId
        });
        return { summary: `Found ${result.total} LaTeX documents.`, data: result.data };
    }
}
