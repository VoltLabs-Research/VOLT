import { createService } from '@/app/core/http/utilities/create-service';
import client from './client';
import endpoints from './endpoints';
import type { CreateScriptingSessionParams } from '../dtos/create-scripting-session';
import type { DeleteScriptingNotebookParams } from '../dtos/delete-scripting-notebook';
import type { ListScriptingNotebooksParams } from '../dtos/list-scripting-notebooks';
import type { ScriptingNotebook } from '../entities/scripting-notebook';
import type { ScriptingSession } from '../entities/scripting-session';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

type ScriptingService = {
    listNotebooks: (params: ListScriptingNotebooksParams) => Promise<PaginatedResponse<ScriptingNotebook>>;
    deleteNotebook: (params: DeleteScriptingNotebookParams) => Promise<void>;
    createSession: (params: CreateScriptingSessionParams) => Promise<ScriptingSession>;
};

const service = createService({ clients: client }, endpoints as never) as ScriptingService;

export default service;
