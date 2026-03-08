import { useMutation } from '@tanstack/react-query';
import {
    buildKeys,
    createMutation,
    createQuery,
    type MutationOptions,
    withSuccess
} from '@/shared/infrastructure/query/create-paginated-query';
import queryClient from '@/shared/infrastructure/query/query-client';
import type { CreateScriptingSessionParams } from '../api/dtos/create-scripting-session';
import type { DeleteScriptingNotebookParams } from '../api/dtos/delete-scripting-notebook';
import type { ListScriptingNotebooksParams } from '../api/dtos/list-scripting-notebooks';
import type { ScriptingSession } from '../api/entities/scripting-session';
import service from '../api/service';

const KEYS = buildKeys<{
    notebooks: ListScriptingNotebooksParams;
}>('scripting');

export const scriptingNotebooksQueryKey = KEYS.notebooks;

export const scriptingNotebooksQuery = createQuery(KEYS.notebooks, service.listNotebooks);


export const invalidateScriptingNotebooksQuery = () => {
    return queryClient.invalidateQueries({ queryKey: KEYS.notebooks() });
};

export const useDeleteScriptingNotebookMutation = (
    options?: MutationOptions<void, DeleteScriptingNotebookParams>
) => {
    return useMutation({
        ...options,
        mutationFn: service.deleteNotebook,
        onSuccess: withSuccess(() => {
            void invalidateScriptingNotebooksQuery();
        }, options)
    });
};

export const useCreateScriptingSessionMutation = createMutation<ScriptingSession, CreateScriptingSessionParams>(
    service.createSession
);
