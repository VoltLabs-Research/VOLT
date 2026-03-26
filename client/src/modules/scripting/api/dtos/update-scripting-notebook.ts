import type { ScriptingNotebookContainerResources } from '@/modules/scripting/api/entities/scripting-notebook';

export interface UpdateScriptingNotebookParams {
    notebookId: string;
    title?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResources;
};
