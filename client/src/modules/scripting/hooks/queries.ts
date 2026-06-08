import service from '../api/scripting-service';
import {
    buildKeys,
    createInvalidatingMutation,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query';
import type {
    CreateScriptingNotebookParams,
    CreateScriptingNotebookSessionParams,
    CreateScriptingSessionParams,
    DeleteScriptingNotebookParams,
    ListScriptingNotebooksParams,
    UpdateScriptingNotebookParams
} from '../api/scripting-service';
import type { ScriptingNotebook } from '../api/entities/scripting-notebook';
import type { ScriptingSession } from '../api/entities/scripting-session';

interface ScriptingQueryKeys {
    notebooks: ListScriptingNotebooksParams;
};

const KEYS = buildKeys<ScriptingQueryKeys>('scripting');

export const scriptingNotebooksQueryKey = KEYS.notebooks;

export const scriptingNotebooksQuery = createQuery(KEYS.notebooks, service.listNotebooks);

export const useCreateScriptingNotebookMutation = createInvalidatingMutation<ScriptingNotebook, CreateScriptingNotebookParams>(
    service.createNotebook,
    [KEYS.notebooks()]
);

export const useDeleteScriptingNotebookMutation = createInvalidatingMutation<void, DeleteScriptingNotebookParams>(
    service.deleteNotebook,
    [KEYS.notebooks()]
);

export const useUpdateScriptingNotebookMutation = createInvalidatingMutation<ScriptingNotebook, UpdateScriptingNotebookParams>(
    service.updateNotebook,
    [KEYS.notebooks()]
);

export const useCreateScriptingSessionMutation = createMutation<ScriptingSession, CreateScriptingSessionParams>(
    service.createSession
);

export const useCreateScriptingNotebookSessionMutation = createMutation<ScriptingSession, CreateScriptingNotebookSessionParams>(
    service.createNotebookSession
);
