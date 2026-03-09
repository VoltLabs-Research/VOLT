import { scriptingAiTools } from '@modules/scripting/application/ai-tools';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/CreateScriptingJupyterSessionUseCase';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/ListScriptingNotebooksUseCase';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import { DaemonScriptingSessionOrchestrator } from '@modules/scripting/infrastructure/services/DaemonScriptingSessionOrchestrator';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { JupyterNotebookService } from '@modules/scripting/infrastructure/services/JupyterNotebookService';
import { ScriptingJupyterProxyService } from '@modules/scripting/infrastructure/services/ScriptingJupyterProxyService';
import { RedisScriptingSessionLock } from '@modules/scripting/infrastructure/services/RedisScriptingSessionLock';
import { SCRIPTING_TOKENS } from './ScriptingTokens';
import type { ClassProvider } from 'tsyringe';
import { container } from 'tsyringe';

const SCRIPTING_AI_TOOL_CLASSES: ClassProvider<unknown>[] = scriptingAiTools.map((useClass) => ({ useClass }));

export const registerScriptingDependencies = (): void => {
    container.registerSingleton(SCRIPTING_TOKENS.ScriptingNotebookRepository, ScriptingNotebookRepository);
    container.registerSingleton(SCRIPTING_TOKENS.ScriptingSessionOrchestrator, DaemonScriptingSessionOrchestrator);
    container.registerSingleton(SCRIPTING_TOKENS.ScriptingSessionLock, RedisScriptingSessionLock);
    container.registerSingleton(JupyterNotebookService);
    container.registerSingleton(ScriptingJupyterAccessTokenService);
    container.registerSingleton(ScriptingJupyterProxyService);

    container.registerSingleton(CreateScriptingJupyterSessionUseCase);
    container.registerSingleton(ListScriptingNotebooksUseCase);
    container.registerSingleton(DeleteScriptingNotebookUseCase);

    // AI Tools
    for (const toolClassProvider of SCRIPTING_AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, toolClassProvider);
    }
};
