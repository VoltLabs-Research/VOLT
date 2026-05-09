import { createService, del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';

import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { ScriptingNotebook, ScriptingNotebookContainerResources } from './entities/scripting-notebook';
import type { ScriptingNotebookScope } from './entities/scripting-notebook-scope';
import type { ScriptingSession } from './entities/scripting-session';

export interface CreateScriptingNotebookParams {
    teamId: string;
    title?: string;
    teamClusterId: string;
    containerResources: ScriptingNotebookContainerResources;
}

export interface CreateScriptingSessionParams {
    trajectoryId: string;
    notebookId?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResources;
}

export interface CreateScriptingNotebookSessionParams {
    notebookId: string;
}

export interface DeleteScriptingNotebookParams {
    notebookId: string;
}

export interface ListScriptingNotebooksParams {
    trajectoryId?: string;
    scope?: ScriptingNotebookScope;
    page?: number;
    limit?: number;
}

export interface UpdateScriptingNotebookParams {
    notebookId: string;
    title?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResources;
}

export interface ReadNotebookSessionStatusParams {
    notebookId: string;
}

export interface DeleteNotebookSessionParams {
    notebookId: string;
}

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
