import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { UpdateScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/UpdateScriptingNotebookUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
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

    constructor(
        protected readonly useCase: UpdateScriptingNotebookUseCase
    ) {
        super();
    }
}
