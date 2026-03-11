import service from '../api/service';
import {
    buildKeys,
    createCachePolicy,
    createManagedMutation,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query';
import type { CreateScriptingNotebookParams } from '../api/dtos/create-scripting-notebook';
import type { CreateScriptingNotebookSessionParams, CreateScriptingSessionParams } from '../api/dtos/create-scripting-session';
import type { DeleteScriptingNotebookParams } from '../api/dtos/delete-scripting-notebook';
import type { ListScriptingNotebooksParams } from '../api/dtos/list-scripting-notebooks';
import type { UpdateScriptingNotebookParams } from '../api/dtos/update-scripting-notebook';
import type { ScriptingNotebook } from '../api/entities/scripting-notebook';
import type { ScriptingSession } from '../api/entities/scripting-session';

interface ScriptingQueryKeys extends Record<string, unknown> {
    notebooks: ListScriptingNotebooksParams;
};

const KEYS = buildKeys<ScriptingQueryKeys>('scripting');

export const scriptingNotebooksQueryKey = KEYS.notebooks;

export const scriptingNotebooksQuery = createQuery(KEYS.notebooks, service.listNotebooks);

const scriptingNotebooksCache = createCachePolicy<void>(() => KEYS.notebooks());

export const invalidateScriptingNotebooksQuery = () => scriptingNotebooksCache.invalidate(undefined);

export const useCreateScriptingNotebookMutation = createManagedMutation<ScriptingNotebook, CreateScriptingNotebookParams>(
    service.createNotebook,
    () => invalidateScriptingNotebooksQuery()
);

export const useDeleteScriptingNotebookMutation = createManagedMutation<void, DeleteScriptingNotebookParams>(
    service.deleteNotebook,
    () => invalidateScriptingNotebooksQuery()
);

export const useUpdateScriptingNotebookMutation = createManagedMutation<ScriptingNotebook, UpdateScriptingNotebookParams>(
    service.updateNotebook,
    () => invalidateScriptingNotebooksQuery()
);

export const useCreateScriptingSessionMutation = createMutation<ScriptingSession, CreateScriptingSessionParams>(
    service.createSession
);

export const useCreateScriptingNotebookSessionMutation = createMutation<ScriptingSession, CreateScriptingNotebookSessionParams>(
    service.createNotebookSession
);
