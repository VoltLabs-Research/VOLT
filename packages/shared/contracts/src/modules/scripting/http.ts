

import type { ScriptingNotebookContainerResources } from './domain';

export interface CreateScriptingNotebookInput{
    title?: string;
    // A connected cluster of the team's when absent.
    teamClusterId?: string;
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
