import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({ documentId: z.string() });
type Params = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListLatexFilesAITool extends AITool<Params> {
    readonly name = 'list_latex_files';
    readonly description = 'List the source files inside a LaTeX document.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        const result = await this.#service.listFiles({ teamId: scope.teamId, documentId: params.documentId });
        return { summary: `Found ${result.length} LaTeX files.`, data: result };
    }
}
