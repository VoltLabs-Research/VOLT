import type { ScriptingNotebookContainerResourcesDTO } from './ScriptingNotebookDTO';
import type { ScriptingNotebookDTO } from './ScriptingNotebookDTO';

export interface CreateScriptingNotebookInputDTO {
    teamId: string;
    userId?: string;
    title?: string;
    teamClusterId: string;
    containerResources: ScriptingNotebookContainerResourcesDTO;
};

export interface CreateScriptingNotebookOutputDTO extends ScriptingNotebookDTO {};
