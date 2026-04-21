import { scriptingAiTools } from '@modules/scripting/application/ai-tools';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/CreateScriptingJupyterSessionUseCase';
import { CreateScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/CreateScriptingNotebookUseCase';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/ListScriptingNotebooksUseCase';
import { UpdateScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/UpdateScriptingNotebookUseCase';
import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import { DaemonScriptingSessionOrchestrator } from '@modules/scripting/infrastructure/services/DaemonScriptingSessionOrchestrator';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { JupyterNotebookService } from '@modules/scripting/infrastructure/services/JupyterNotebookService';
import { ScriptingJupyterProxyService } from '@modules/scripting/infrastructure/services/ScriptingJupyterProxyService';
import { RedisScriptingSessionLock } from '@modules/scripting/infrastructure/services/RedisScriptingSessionLock';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { createClassBindings } from '@shared/infrastructure/di/ModuleManifest';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const scriptingDIManifest: ModuleManifest = {
    name: 'scripting',
    singletons: [
        [SCRIPTING_TOKENS.ScriptingNotebookRepository, ScriptingNotebookRepository],
        [SCRIPTING_TOKENS.ScriptingSessionOrchestrator, DaemonScriptingSessionOrchestrator],
        [SCRIPTING_TOKENS.ScriptingSessionLock, RedisScriptingSessionLock],
        JupyterNotebookService,
        ScriptingJupyterAccessTokenService,
        ScriptingJupyterProxyService,
        CreateScriptingJupyterSessionUseCase,
        CreateScriptingNotebookUseCase,
        ListScriptingNotebooksUseCase,
        DeleteScriptingNotebookUseCase,
        UpdateScriptingNotebookUseCase
    ],
    bindings: [
        ...createClassBindings(AI_TOKENS.AITool, scriptingAiTools)
    ]
};
