import service from '../api/service';
import {
    buildKeys,
    createMutation,
    createQuery,
    withSuccess
} from '@/shared/infrastructure/query/create-paginated-query';
import queryClient from '@/shared/infrastructure/query/query-client';
import { useMutation } from '@tanstack/react-query';
import type { MutationOptions } from '@/shared/infrastructure/query/create-paginated-query';
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


export const invalidateScriptingNotebooksQuery = () => {
    return queryClient.invalidateQueries({ queryKey: KEYS.notebooks() });
};

export const useDeleteScriptingNotebookMutation = (
    options?: MutationOptions<void, DeleteScriptingNotebookParams>
) => {
    return useMutation({
        ...options,
        mutationFn: deleteNotebook,
        onSuccess: withSuccess(() => {
            invalidateScriptingNotebooksQuery();
        }, options)
    });
};

export const useCreateScriptingSessionMutation = createMutation<ScriptingSession, CreateScriptingSessionParams>(
    createSession
);
