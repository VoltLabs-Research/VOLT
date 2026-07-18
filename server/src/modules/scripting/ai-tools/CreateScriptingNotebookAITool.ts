import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import { CreateScriptingNotebookUseCase } from '@modules/scripting/use-cases/CreateScriptingNotebookUseCase';
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

    constructor(
        protected readonly useCase: CreateScriptingNotebookUseCase
    ) {
        super();
    }
}
