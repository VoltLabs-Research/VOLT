import type { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import type { ScriptingNotebookDTO } from './ScriptingNotebookDTO';

export interface ListScriptingNotebooksInputDTO {
    teamId: string;
    trajectoryId?: string;
    page?: number | string;
    limit?: number | string;
}

export interface ListScriptingNotebooksOutputDTO extends PaginatedResult<ScriptingNotebookDTO> {}
