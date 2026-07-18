import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetScriptingSessionStatusAITool extends AITool {
    readonly name = 'get_scripting_session_status';
    readonly description = 'Get the Jupyter session status for a scripting notebook.';
    readonly parameters = z.object({ notebookId: z.string() });

    #service = new ScriptingService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getSessionStatus({
            teamId: scope.teamId,
            userId: scope.userId,
            notebookId: params.notebookId
        });
        return { summary: `Session ${value.jupyter.ready ? 'ready' : 'not ready'} for notebook ${value.notebookId}.`, data: value };
    }
}
