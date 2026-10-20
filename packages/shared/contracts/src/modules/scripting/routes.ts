import { get, post, patch, del } from '../../shared/routing';
import type {
    CreateScriptingNotebookInput,
    UpdateScriptingNotebookInput,
    CreateScriptingJupyterSessionInput
} from './http';
import type {
    ScriptingNotebook,
    CreateScriptingJupyterSessionResponse,
    GetScriptingSessionStatusResponse,
    DeleteScriptingSessionResponse
} from './domain';

export const scriptingRoutes = {
    listNotebooks: get<ScriptingNotebook>('/api/teams/:teamId/notebooks'),
    createNotebook: post<CreateScriptingNotebookInput, ScriptingNotebook>('/api/teams/:teamId/notebooks'),
    updateNotebook: patch<UpdateScriptingNotebookInput, ScriptingNotebook>('/api/teams/:teamId/notebooks/:notebookId'),
    getSessionStatus: get<GetScriptingSessionStatusResponse>('/api/teams/:teamId/notebook-sessions/:notebookId/status'),
    deleteSession: del<DeleteScriptingSessionResponse>('/api/teams/:teamId/notebook-sessions/:notebookId'),
    createJupyterSession: post<CreateScriptingJupyterSessionInput, CreateScriptingJupyterSessionResponse>('/api/teams/:teamId/notebook-sessions'),
    removeNotebook: del('/api/teams/:teamId/notebooks/:notebookId')
} as const;
