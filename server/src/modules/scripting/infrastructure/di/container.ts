import { container } from 'tsyringe';
import { JupyterService } from '@modules/scripting/infrastructure/services/JupyterService';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import { SCRIPTING_TOKENS } from './ScriptingTokens';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/scripting/CreateScriptingJupyterSessionUseCase';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/scripting/ListScriptingNotebooksUseCase';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/scripting/DeleteScriptingNotebookUseCase';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as scriptingAiTools from '@modules/scripting/application/ai-tools';

export const registerScriptingDependencies = (): void => {
    container.registerSingleton(JupyterService);
    container.registerSingleton(SCRIPTING_TOKENS.ScriptingNotebookRepository, ScriptingNotebookRepository);

    container.registerSingleton(CreateScriptingJupyterSessionUseCase);
    container.registerSingleton(ListScriptingNotebooksUseCase);
    container.registerSingleton(DeleteScriptingNotebookUseCase);

    // AI Tools
    for (const ToolClass of Object.values(scriptingAiTools)) {
        container.registerSingleton(AI_TOKENS.AITool, ToolClass as any);
    }
};
