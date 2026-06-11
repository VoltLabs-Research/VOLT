import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { CreateScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/CreateScriptingNotebookUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOKENS.AITool)
export class CreateScriptingNotebookAITool extends AITool {
    readonly name = 'create_scripting_notebook';
    readonly description = 'Create a new scripting Jupyter notebook.';
    readonly parameters = z.object({
        teamClusterId: z.string(),
        title: z.string().optional()
    });

    constructor(
        protected readonly useCase: CreateScriptingNotebookUseCase
    ) {
        super();
    }
}
