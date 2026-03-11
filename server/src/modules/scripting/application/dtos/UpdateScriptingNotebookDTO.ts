import type { ScriptingNotebookDTO } from './ScriptingNotebookDTO';

export interface UpdateScriptingNotebookInputDTO {
    teamId: string;
    notebookId: string;
    title: string;
};

export type UpdateScriptingNotebookOutputDTO = ScriptingNotebookDTO;
