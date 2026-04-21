import type { ScriptingNotebookContainerResourcesDTO } from './ScriptingNotebookDTO';

export interface UpdateScriptingNotebookInputDTO {
    teamId: string;
    notebookId: string;
    title?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResourcesDTO;
};
