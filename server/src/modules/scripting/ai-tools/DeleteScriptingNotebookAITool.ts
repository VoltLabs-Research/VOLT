import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/use-cases/DeleteScriptingNotebookUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class DeleteScriptingNotebookAITool extends AITool {
    readonly name = 'delete_scripting_notebook';
    readonly description = 'Delete a scripting Jupyter notebook.';
    readonly parameters = z.object({ notebookId: z.string() });

    constructor(
        protected readonly useCase: DeleteScriptingNotebookUseCase
    ) {
        super();
    }
}
