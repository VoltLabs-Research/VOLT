import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ListScriptingNotebooksAITool extends AITool {
    readonly name = 'list_scripting_notebooks';
    readonly description = 'List scripting Jupyter notebooks in the team.';
    readonly parameters = z.object({
        trajectoryId: z.string().optional(),
        scope: z.nativeEnum(ScriptingNotebookScope).optional(),
        page: z.number().optional().default(1),
        limit: z.number().optional().default(500)
    });

    #service = new ScriptingService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.listNotebooks({
            teamId: scope.teamId,
            trajectoryId: params.trajectoryId,
            scope: params.scope,
            page: params.page,
            limit: params.limit
        });
        return { summary: `Found ${value.total} scripting notebooks.`, data: value.data };
    }
}
