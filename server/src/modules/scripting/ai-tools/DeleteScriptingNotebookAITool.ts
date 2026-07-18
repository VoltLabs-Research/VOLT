import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class DeleteScriptingNotebookAITool extends AITool {
    readonly name = 'delete_scripting_notebook';
    readonly description = 'Delete a scripting Jupyter notebook.';
    readonly parameters = z.object({ notebookId: z.string() });

    #service = new ScriptingService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.deleteNotebook({
            notebookId: params.notebookId,
            teamId: scope.teamId
        });
    }
}
