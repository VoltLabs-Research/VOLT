import { del, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ScriptingNotebook } from '@/modules/scripting/api/entities/scripting-notebook';
import type { CreateScriptingNotebookParams } from '../../dtos/create-scripting-notebook';
import type { DeleteScriptingNotebookParams } from '../../dtos/delete-scripting-notebook';
import type { ListScriptingNotebooksParams } from '../../dtos/list-scripting-notebooks';
import type { UpdateScriptingNotebookParams } from '../../dtos/update-scripting-notebook';

const endpoints = {
    listNotebooks: paginated<ListScriptingNotebooksParams, PaginatedResponse<ScriptingNotebook>>(
        ({ trajectoryId }) => trajectoryId ? `/${trajectoryId}/notebooks` : '/notebooks',
        { omit: ['trajectoryId'] }
    ),
    createNotebook: post<CreateScriptingNotebookParams, ScriptingNotebook>('/notebooks', {
        body: ({ title }) => ({ title })
    }),
    updateNotebook: patch<UpdateScriptingNotebookParams, ScriptingNotebook>('/notebooks/:notebookId', {
        body: ({ title }) => ({ title })
    }),
    deleteNotebook: del<DeleteScriptingNotebookParams>('/notebooks/:notebookId')
};

export default endpoints;
