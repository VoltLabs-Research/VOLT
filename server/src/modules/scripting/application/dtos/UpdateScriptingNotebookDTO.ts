import type { ScriptingNotebookContainerResourcesDTO, ScriptingNotebookDTO } from './ScriptingNotebookDTO';

export interface UpdateScriptingNotebookInputDTO {
    teamId: string;
    notebookId: string;
    title?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResourcesDTO;
};

export type UpdateScriptingNotebookOutputDTO = ScriptingNotebookDTO;
