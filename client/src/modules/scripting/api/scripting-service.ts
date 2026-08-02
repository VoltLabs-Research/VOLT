import { createService, del, get, paginated, patch, post } from '@/app/core/http/utils/create-service';

import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { ScriptingNotebook, ScriptingNotebookContainerResources } from '@volt/contracts/modules/scripting/domain';
import type { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import type {
    CreateScriptingJupyterSessionResponse,
    GetScriptingSessionStatusResponse
} from '@volt/contracts/modules/scripting/domain';

export interface CreateScriptingNotebookParams {
    teamId: string;
    title?: string;
    teamClusterId: string;
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

interface ReadNotebookSessionStatusParams {
    notebookId: string;
}

interface DeleteNotebookSessionParams {
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
    createSession: post<CreateScriptingSessionParams, CreateScriptingJupyterSessionResponse>('/notebook-sessions', {
        body: ({ notebookId, trajectoryId, teamClusterId }) => ({
            notebookId,
            trajectoryId,
            teamClusterId
        })
    }),
    readNotebookSessionStatus: get<ReadNotebookSessionStatusParams, GetScriptingSessionStatusResponse>('/notebook-sessions/:notebookId/status'),
    deleteNotebookSession: del<DeleteNotebookSessionParams>('/notebook-sessions/:notebookId')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        }
    }
}, endpoints);
