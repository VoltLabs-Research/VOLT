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
    listNotebooks: get<ScriptingNotebook>('/api/scripting/:teamId/notebooks'),
    createNotebook: post<CreateScriptingNotebookInput, ScriptingNotebook>('/api/scripting/:teamId/notebooks'),
    updateNotebook: patch<UpdateScriptingNotebookInput, ScriptingNotebook>('/api/scripting/:teamId/notebooks/:notebookId'),
    listNotebooksByTrajectory: get<ScriptingNotebook>('/api/scripting/:teamId/:trajectoryId/notebooks'),
    getSessionStatus: get<GetScriptingSessionStatusResponse>('/api/scripting/:teamId/sessions/:notebookId/status'),
    deleteSession: del<DeleteScriptingSessionResponse>('/api/scripting/:teamId/sessions/:notebookId'),
    createJupyterSession: post<CreateScriptingJupyterSessionInput, CreateScriptingJupyterSessionResponse>('/api/scripting/:teamId/sessions'),
    createJupyterSessionByTrajectory: post<CreateScriptingJupyterSessionInput, CreateScriptingJupyterSessionResponse>('/api/scripting/:teamId/:trajectoryId/sessions'),
    removeNotebook: del('/api/scripting/:teamId/notebooks/:notebookId')
} as const;
