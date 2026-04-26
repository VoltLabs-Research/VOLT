import { createService, del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { CreateScriptingNotebookParams } from './dtos/create-scripting-notebook';
import type { CreateScriptingNotebookSessionParams, CreateScriptingSessionParams } from './dtos/create-scripting-session';
import type { DeleteScriptingNotebookParams } from './dtos/delete-scripting-notebook';
import type { ListScriptingNotebooksParams } from './dtos/list-scripting-notebooks';
import type { UpdateScriptingNotebookParams } from './dtos/update-scripting-notebook';
import type { ScriptingNotebook } from './entities/scripting-notebook';
import type { ScriptingSession } from './entities/scripting-session';

export interface ReadNotebookSessionStatusParams {
    notebookId: string;
};

export interface DeleteNotebookSessionParams {
    notebookId: string;
};

const endpoints = {
    listNotebooks: paginated<ListScriptingNotebooksParams, PaginatedResponse<ScriptingNotebook>>(
        ({ trajectoryId }) => trajectoryId ? `/${trajectoryId}/notebooks` : '/notebooks',
        { omit: ['trajectoryId'] }
    ),
    createNotebook: post<CreateScriptingNotebookParams, ScriptingNotebook>('/notebooks', {
        body: ({ title, teamClusterId, containerResources }) => ({ title, teamClusterId, containerResources })
    }),
    updateNotebook: patch<UpdateScriptingNotebookParams, ScriptingNotebook>('/notebooks/:notebookId', {
        body: ({ title, teamClusterId, containerResources }) => ({ title, teamClusterId, containerResources })
    }),
    deleteNotebook: del<DeleteScriptingNotebookParams>('/notebooks/:notebookId'),
    createSession: post<CreateScriptingSessionParams, ScriptingSession>('/:trajectoryId/sessions', {
        body: ({ notebookId, teamClusterId, containerResources }) => ({ notebookId, teamClusterId, containerResources })
    }),
    createNotebookSession: post<CreateScriptingNotebookSessionParams, ScriptingSession>('/sessions', {
        body: ({ notebookId }) => ({ notebookId })
    }),
    readNotebookSessionStatus: get<ReadNotebookSessionStatusParams, ScriptingSession>('/sessions/:notebookId/status'),
    deleteNotebookSession: del<DeleteNotebookSessionParams>('/sessions/:notebookId')
};

export default createService({
    clients: {
        default: {
            basePath: '/scripting',
            useRBAC: true
        }
    }
}, endpoints);
