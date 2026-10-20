

import type { ScriptingNotebookContainerResources } from './domain';

export interface CreateScriptingNotebookInput{
    title?: string;
    teamClusterId: string;
}

export interface UpdateScriptingNotebookInput{
    title?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResources;
}

export interface CreateScriptingJupyterSessionInput{
    notebookId?: string;
    trajectoryId?: string;
    teamClusterId?: string;
}
