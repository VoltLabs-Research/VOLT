import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class CreateScriptingNotebookAITool extends AITool {
    readonly name = 'create_scripting_notebook';
    readonly description = 'Create a new scripting Jupyter notebook.';
    readonly parameters = z.object({
        teamClusterId: z.string(),
        title: z.string().optional()
    });

    #service = new ScriptingService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.createNotebook({
            teamId: scope.teamId,
            userId: scope.userId,
            title: params.title,
            teamClusterId: params.teamClusterId
        });
    }
}
