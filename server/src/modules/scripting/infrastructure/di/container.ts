import { scriptingAiTools } from '@modules/scripting/application/ai-tools';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/CreateScriptingJupyterSessionUseCase';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/ListScriptingNotebooksUseCase';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import { JupyterContainerManager } from '@modules/scripting/infrastructure/services/JupyterContainerManager';
import { JupyterNotebookService } from '@modules/scripting/infrastructure/services/JupyterNotebookService';
import { JupyterServerService } from '@modules/scripting/infrastructure/services/JupyterServerService';
import { JupyterSessionOrchestrator } from '@modules/scripting/infrastructure/services/JupyterSessionOrchestrator';
import { RedisScriptingSessionLock } from '@modules/scripting/infrastructure/services/RedisScriptingSessionLock';
import { SCRIPTING_TOKENS } from './ScriptingTokens';
import { container } from 'tsyringe';
import type { AITool } from '@shared/application/ai/AITool';

export const registerScriptingDependencies = (): void => {
    container.registerSingleton(SCRIPTING_TOKENS.ScriptingNotebookRepository, ScriptingNotebookRepository);
    container.registerSingleton(SCRIPTING_TOKENS.ScriptingSessionOrchestrator, JupyterSessionOrchestrator);
    container.registerSingleton(SCRIPTING_TOKENS.ScriptingSessionLock, RedisScriptingSessionLock);
    container.registerSingleton(JupyterContainerManager);
    container.registerSingleton(JupyterNotebookService);
    container.registerSingleton(JupyterServerService);

    container.registerSingleton(CreateScriptingJupyterSessionUseCase);
    container.registerSingleton(ListScriptingNotebooksUseCase);
    container.registerSingleton(DeleteScriptingNotebookUseCase);

    // AI Tools
    for (const ToolClass of scriptingAiTools) {
        container.registerSingleton<AITool>(AI_TOKENS.AITool, ToolClass);
    }
};
