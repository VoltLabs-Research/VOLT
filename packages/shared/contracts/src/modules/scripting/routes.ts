import { get, post, patch, put, del } from '../../shared/routing';
import type {
    CreateScriptingNotebookInput,
    UpdateScriptingNotebookInput,
    CreateScriptingJupyterSessionInput
} from './http';
import type {
    ScriptingNotebook,
    ScriptingNotebookWithContent,
    NotebookDocument,
    NotebookKernelEnvironment,
    SaveNotebookContentResponse,
    CreateScriptingJupyterSessionResponse,
    GetScriptingSessionStatusResponse,
    DeleteScriptingSessionResponse
} from './domain';

export const scriptingRoutes = {
    listNotebooks: get<ScriptingNotebook>('/api/teams/:teamId/notebooks'),
    createNotebook: post<CreateScriptingNotebookInput, ScriptingNotebook>('/api/teams/:teamId/notebooks'),
    updateNotebook: patch<UpdateScriptingNotebookInput, ScriptingNotebook>('/api/teams/:teamId/notebooks/:notebookId'),
    getNotebook: get<ScriptingNotebookWithContent>('/api/teams/:teamId/notebooks/:notebookId'),
    // The body is the document, as NOTEBOOK_MEDIA_TYPE.
    saveNotebookContent: put<NotebookDocument, SaveNotebookContentResponse>('/api/teams/:teamId/notebooks/:notebookId/content'),
    createNotebookKernel: post<never, NotebookKernelEnvironment>('/api/teams/:teamId/notebooks/:notebookId/kernel'),
    getSessionStatus: get<GetScriptingSessionStatusResponse>('/api/teams/:teamId/notebook-sessions/:notebookId/status'),
    deleteSession: del<DeleteScriptingSessionResponse>('/api/teams/:teamId/notebook-sessions/:notebookId'),
    createJupyterSession: post<CreateScriptingJupyterSessionInput, CreateScriptingJupyterSessionResponse>('/api/teams/:teamId/notebook-sessions'),
    removeNotebook: del('/api/teams/:teamId/notebooks/:notebookId')
} as const;
