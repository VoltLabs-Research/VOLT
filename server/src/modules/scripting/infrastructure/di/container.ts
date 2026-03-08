import { container } from 'tsyringe';
import { JupyterSessionOrchestrator } from '@modules/scripting/infrastructure/services/JupyterSessionOrchestrator';
import { JupyterContainerManager } from '@modules/scripting/infrastructure/services/JupyterContainerManager';
import { JupyterNotebookService } from '@modules/scripting/infrastructure/services/JupyterNotebookService';
import { JupyterServerService } from '@modules/scripting/infrastructure/services/JupyterServerService';
import { RedisScriptingSessionLock } from '@modules/scripting/infrastructure/services/RedisScriptingSessionLock';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import { SCRIPTING_TOKENS } from './ScriptingTokens';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/CreateScriptingJupyterSessionUseCase';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/ListScriptingNotebooksUseCase';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import * as scriptingAiTools from '@modules/scripting/application/ai-tools';

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
    for (const ToolClass of Object.values(scriptingAiTools)) {
        container.registerSingleton(AI_TOKENS.AITool, ToolClass as any);
    }
};
