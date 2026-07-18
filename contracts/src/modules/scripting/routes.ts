import { get, post, patch, del } from '../../shared/routing';
import type {
    CreateScriptingNotebookInput,
    UpdateScriptingNotebookInput,
    CreateScriptingJupyterSessionInput
} from './http';
import type {
    PersistedScriptingNotebook,
    CreateScriptingJupyterSessionResponse,
    GetScriptingSessionStatusResponse,
    DeleteScriptingSessionResponse
} from './domain';

/**
 * Every client-facing scripting endpoint, typed by request/response. All paths
 * are the full wire paths (team-scoped under `/api/scripting/:teamId`), matching
 * the previous `createHttpModule({ basePath: '/api/scripting/:teamId', resource: Resource.SCRIPTING })`
 * routing verbatim, in the SAME registration order. `list`/`listByTrajectory`
 * and `createJupyterSession`/`createJupyterSessionByTrajectory` are two wire rows
 * each, mapped to one controller method (stacked `@Route`s). The Jupyter HTTP
 * proxy under `/api/jupyter/:teamId/notebooks/:runtimeNotebookId` is NOT part of
 * this table — it is a raw pass-through handler mounted separately (kept as
 * `scripting-jupyter-routes` and driven by the stateful proxy singleton).
 */
export const scriptingRoutes = {
    listNotebooks: get<PersistedScriptingNotebook>('/api/scripting/:teamId/notebooks'),
    createNotebook: post<CreateScriptingNotebookInput, PersistedScriptingNotebook>('/api/scripting/:teamId/notebooks'),
    updateNotebook: patch<UpdateScriptingNotebookInput, PersistedScriptingNotebook>('/api/scripting/:teamId/notebooks/:notebookId'),
    listNotebooksByTrajectory: get<PersistedScriptingNotebook>('/api/scripting/:teamId/:trajectoryId/notebooks'),
    getSessionStatus: get<GetScriptingSessionStatusResponse>('/api/scripting/:teamId/sessions/:notebookId/status'),
    deleteSession: del<DeleteScriptingSessionResponse>('/api/scripting/:teamId/sessions/:notebookId'),
    createJupyterSession: post<CreateScriptingJupyterSessionInput, CreateScriptingJupyterSessionResponse>('/api/scripting/:teamId/sessions'),
    createJupyterSessionByTrajectory: post<CreateScriptingJupyterSessionInput, CreateScriptingJupyterSessionResponse>('/api/scripting/:teamId/:trajectoryId/sessions'),
    removeNotebook: del('/api/scripting/:teamId/notebooks/:notebookId')
} as const;
