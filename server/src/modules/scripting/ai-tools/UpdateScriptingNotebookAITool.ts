import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ScriptingService from '@modules/scripting/services/ScriptingService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class UpdateScriptingNotebookAITool extends AITool {
    readonly name = 'update_scripting_notebook';
    readonly description = 'Update a scripting Jupyter notebook.';
    readonly parameters = z.object({
        notebookId: z.string(),
        title: z.string().optional(),
        teamClusterId: z.string().optional(),
        containerResources: z.object({
            cpus: z.number(),
            memoryMB: z.number()
        }).optional()
    });

    #service = new ScriptingService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        return this.#service.updateNotebook({
            teamId: scope.teamId,
            notebookId: params.notebookId,
            title: params.title,
            teamClusterId: params.teamClusterId,
            containerResources: params.containerResources
        });
    }
}
