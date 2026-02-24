import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ScriptingNotebookDTO } from './ScriptingNotebookDTO';

export interface ListScriptingNotebooksInputDTO {
    trajectoryId?: string;
    page?: number;
    limit?: number;
}

export type ListScriptingNotebooksOutputDTO = PaginatedResponse<ScriptingNotebookDTO>;
