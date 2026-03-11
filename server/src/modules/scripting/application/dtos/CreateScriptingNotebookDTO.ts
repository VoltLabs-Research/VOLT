import type { ScriptingNotebookDTO } from './ScriptingNotebookDTO';

export interface CreateScriptingNotebookInputDTO {
    teamId: string;
    userId?: string;
    title?: string;
};

export interface CreateScriptingNotebookOutputDTO extends ScriptingNotebookDTO {};
