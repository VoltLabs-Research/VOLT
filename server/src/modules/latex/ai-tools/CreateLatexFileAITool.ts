import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    documentId: z.string(),
    name: z.string(),
    path: z.string().optional(),
    content: z.string().optional(),
    isEntrypoint: z.boolean().optional()
});
type Params = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class CreateLatexFileAITool extends AITool<Params> {
    readonly name = 'create_latex_file';
    readonly description = 'Create a new source file inside a LaTeX document.';
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        return this.#service.createFile({ teamId: scope.teamId, userId: scope.userId, ...params });
    }
}
