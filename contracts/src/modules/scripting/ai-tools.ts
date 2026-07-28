import type { tags } from 'typia';
import type { ScriptingNotebookContainerResources, ScriptingNotebookScope } from './domain';

export interface NotebookRefInput{
    notebookId: string;
}

export interface CreateScriptingNotebookInput{
    teamClusterId: string;
    title?: string;
}

export interface ListScriptingNotebooksInput{
    trajectoryId?: string;
    scope?: ScriptingNotebookScope;
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<500>;
}

export interface UpdateScriptingNotebookInput{
    notebookId: string;
    title?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResources;
}

export interface StartScriptingJupyterSessionInput{
    notebookId?: string;
    trajectoryId?: string;
    teamClusterId?: string;
}
