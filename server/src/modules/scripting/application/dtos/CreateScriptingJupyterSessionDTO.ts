import type { ScriptingSessionJupyterInfo } from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';

export interface CreateScriptingJupyterSessionInputDTO {
    teamId: string;
    trajectoryId?: string;
    userId?: string;
    notebookId?: string;
    teamClusterId?: string;
}

export interface CreateScriptingJupyterSessionOutputDTO {
    notebookId: string;
    jupyter: ScriptingSessionJupyterInfo;
}
