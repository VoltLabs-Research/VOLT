import type { ScriptingNotebookContainerResources } from '@/modules/scripting/api/entities/scripting-notebook';

export interface CreateScriptingNotebookParams {
    teamId: string;
    title?: string;
    teamClusterId: string;
    containerResources: ScriptingNotebookContainerResources;
};
