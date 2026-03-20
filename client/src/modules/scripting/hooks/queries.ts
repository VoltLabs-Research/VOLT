import service from '../api/service';
import {
    buildKeys,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
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

export const invalidateScriptingNotebooksQuery = () => queryClient.invalidateQueries({ queryKey: KEYS.notebooks() });

export const useCreateScriptingNotebookMutation = createMutation<ScriptingNotebook, CreateScriptingNotebookParams>(
    service.createNotebook,
    () => invalidateScriptingNotebooksQuery()
);

export const useDeleteScriptingNotebookMutation = createMutation<void, DeleteScriptingNotebookParams>(
    service.deleteNotebook,
    () => invalidateScriptingNotebooksQuery()
);

export const useUpdateScriptingNotebookMutation = createMutation<ScriptingNotebook, UpdateScriptingNotebookParams>(
    service.updateNotebook,
    () => invalidateScriptingNotebooksQuery()
);

export const useCreateScriptingSessionMutation = createMutation<ScriptingSession, CreateScriptingSessionParams>(
    service.createSession
);

export const useCreateScriptingNotebookSessionMutation = createMutation<ScriptingSession, CreateScriptingNotebookSessionParams>(
    service.createNotebookSession
);
