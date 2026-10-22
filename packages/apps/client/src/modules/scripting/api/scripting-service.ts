import { createService, del, get, paginated, patch, post, request } from '@/app/core/http/utils/create-service';

import type { PaginatedResponse } from '@voltstack/voltclient';
import type { ScriptingNotebook, ScriptingNotebookContainerResources } from '@volt/contracts/modules/scripting/domain';
import type { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import type {
    CreateScriptingJupyterSessionResponse,
    GetScriptingSessionStatusResponse,
    NotebookDocument,
    NotebookKernelEnvironment,
    SaveNotebookContentResponse,
    ScriptingNotebookWithContent
} from '@volt/contracts/modules/scripting/domain';
import { NOTEBOOK_MEDIA_TYPE } from '@volt/contracts/modules/scripting/domain';

export interface CreateScriptingNotebookParams {
    teamId: string;
    title?: string;
    // A connected cluster of the team's when absent.
    teamClusterId?: string;
}

export interface NotebookIdParams {
    notebookId: string;
}

export interface SaveNotebookContentParams {
    notebookId: string;
    content: NotebookDocument;
}

export interface CreateScriptingSessionParams {
    trajectoryId?: string;
    notebookId?: string;
    teamClusterId?: string;
}

export interface DeleteScriptingNotebookParams {
    notebookId: string;
}

export interface ListScriptingNotebooksParams {
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

interface ReadNotebookSessionStatusParams {
    notebookId: string;
}

const endpoints = {
    listNotebooks: paginated<ListScriptingNotebooksParams, PaginatedResponse<ScriptingNotebook>>('/notebooks'),
    createNotebook: post<CreateScriptingNotebookParams, ScriptingNotebook>('/notebooks', {
        body: ({ title, teamClusterId }) => ({
            title,
            teamClusterId
        })
    }),
    updateNotebook: patch<UpdateScriptingNotebookParams, ScriptingNotebook>('/notebooks/:notebookId', {
        body: ({ title, teamClusterId, containerResources }) => ({
            title,
            teamClusterId,
            containerResources
        })
    }),
    deleteNotebook: del<DeleteScriptingNotebookParams>('/notebooks/:notebookId'),
    getNotebook: get<NotebookIdParams, ScriptingNotebookWithContent>('/notebooks/:notebookId'),
    // As a notebook file, which may be larger than the server takes as JSON.
    saveNotebookContent: request<SaveNotebookContentParams, SaveNotebookContentResponse>('PUT', '/notebooks/:notebookId/content', {
        body: ({ content }) => JSON.stringify(content),
        headers: { 'Content-Type': NOTEBOOK_MEDIA_TYPE }
    }),
    createNotebookKernel: post<NotebookIdParams, NotebookKernelEnvironment>('/notebooks/:notebookId/kernel'),
    createSession: post<CreateScriptingSessionParams, CreateScriptingJupyterSessionResponse>('/notebook-sessions', {
        body: ({ notebookId, trajectoryId, teamClusterId }) => ({
            notebookId,
            trajectoryId,
            teamClusterId
        })
    }),
    readNotebookSessionStatus: get<ReadNotebookSessionStatusParams, GetScriptingSessionStatusResponse>('/notebook-sessions/:notebookId/status')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
