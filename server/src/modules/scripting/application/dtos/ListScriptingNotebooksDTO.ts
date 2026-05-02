import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { ScriptingNotebookDTO } from './ScriptingNotebookDTO';
import type { ScriptingNotebookScope } from '@modules/scripting/domain/entities/ScriptingNotebookScope';

export interface ListScriptingNotebooksInputDTO {
    teamId: string;
    trajectoryId?: string;
    scope?: ScriptingNotebookScope;
    page?: number;
    limit?: number;
}

export interface ListScriptingNotebooksOutputDTO extends PaginatedResult<ScriptingNotebookDTO> {}
