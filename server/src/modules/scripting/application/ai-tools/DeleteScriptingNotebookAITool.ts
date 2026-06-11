import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
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
