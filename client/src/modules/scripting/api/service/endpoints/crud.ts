import { paginated, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ScriptingNotebook } from '@/modules/scripting/api/entities/scripting-notebook';
import type { ListScriptingNotebooksParams } from '../../dtos/list-scripting-notebooks';
import type { DeleteScriptingNotebookParams } from '../../dtos/delete-scripting-notebook';

const endpoints = {
    listNotebooks: paginated<ListScriptingNotebooksParams, PaginatedResponse<ScriptingNotebook>>(
        ({ trajectoryId }) => trajectoryId ? `/${trajectoryId}/notebooks` : '/notebooks'
    ),
    deleteNotebook: del<DeleteScriptingNotebookParams>('/notebooks/:notebookId')
};

export default endpoints;
