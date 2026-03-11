import type { ScriptingNotebookScope } from '@/modules/scripting/api/entities/scripting-notebook-scope';

export interface ListScriptingNotebooksParams {
    trajectoryId?: string;
    scope?: ScriptingNotebookScope;
    page?: number;
    limit?: number;
};
