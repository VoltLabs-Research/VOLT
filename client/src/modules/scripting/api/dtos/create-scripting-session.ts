import type { ScriptingNotebookContainerResources } from '@/modules/scripting/api/entities/scripting-notebook';

export interface CreateScriptingSessionParams {
    trajectoryId: string;
    notebookId?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResources;
};

export interface CreateScriptingNotebookSessionParams {
    notebookId: string;
};
