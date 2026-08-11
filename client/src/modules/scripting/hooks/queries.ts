import service from '../api/scripting-service';
import { buildKeys } from '@/shared/query/query-keys';
import { createInvalidatingMutation, createMutation } from '@/shared/query/create-mutation';
import type {
    CreateScriptingNotebookParams,
    CreateScriptingSessionParams,
    DeleteScriptingNotebookParams,
    ListScriptingNotebooksParams,
    UpdateScriptingNotebookParams
} from '../api/scripting-service';
import type { ScriptingNotebook } from '@volt/contracts/modules/scripting/domain';
import type { CreateScriptingJupyterSessionResponse } from '@volt/contracts/modules/scripting/domain';

interface ScriptingQueryKeys {
    notebooks: ListScriptingNotebooksParams;
};

const KEYS = buildKeys<ScriptingQueryKeys>('scripting');

export const scriptingNotebooksQueryKey = KEYS.notebooks;

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

export const useCreateScriptingSessionMutation = createMutation<CreateScriptingJupyterSessionResponse, CreateScriptingSessionParams>(
    service.createSession
);
