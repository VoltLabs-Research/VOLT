import service from '../api/service';
import {
    buildKeys,
    createCachePolicy,
    createManagedMutation,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query';
import type { CreateScriptingSessionParams } from '../api/dtos/create-scripting-session';
import type { DeleteScriptingNotebookParams } from '../api/dtos/delete-scripting-notebook';
import type { ListScriptingNotebooksParams } from '../api/dtos/list-scripting-notebooks';
import type { ScriptingSession } from '../api/entities/scripting-session';

interface ScriptingQueryKeys extends Record<string, unknown> {
    notebooks: ListScriptingNotebooksParams;
};

const KEYS = buildKeys<ScriptingQueryKeys>('scripting');
const listNotebooks = (params: ListScriptingNotebooksParams) => service.listNotebooks(params);
const deleteNotebook = (params: DeleteScriptingNotebookParams) => service.deleteNotebook(params);
const createSession = (params: CreateScriptingSessionParams) => service.createSession(params);

export const scriptingNotebooksQueryKey = KEYS.notebooks;

export const scriptingNotebooksQuery = createQuery(KEYS.notebooks, listNotebooks);

const scriptingNotebooksCache = createCachePolicy<void>(() => KEYS.notebooks());

export const invalidateScriptingNotebooksQuery = () => scriptingNotebooksCache.invalidate(undefined);

export const useDeleteScriptingNotebookMutation = createManagedMutation<void, DeleteScriptingNotebookParams>(
    deleteNotebook,
    () => invalidateScriptingNotebooksQuery()
);

export const useCreateScriptingSessionMutation = createMutation<ScriptingSession, CreateScriptingSessionParams>(
    createSession
);
