import { defineServiceModule } from '@/shared/api/service-module';
import client from './client';
import endpoints from './endpoints';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { CreateScriptingNotebookParams } from '../dtos/create-scripting-notebook';
import type { CreateScriptingNotebookSessionParams, CreateScriptingSessionParams } from '../dtos/create-scripting-session';
import type { DeleteScriptingNotebookParams } from '../dtos/delete-scripting-notebook';
import type { ListScriptingNotebooksParams } from '../dtos/list-scripting-notebooks';
import type { UpdateScriptingNotebookParams } from '../dtos/update-scripting-notebook';
import type { ScriptingNotebook } from '../entities/scripting-notebook';
import type { ScriptingSession } from '../entities/scripting-session';

type ScriptingService = {
    listNotebooks: (params: ListScriptingNotebooksParams) => Promise<PaginatedResponse<ScriptingNotebook>>;
    createNotebook: (params: CreateScriptingNotebookParams) => Promise<ScriptingNotebook>;
    updateNotebook: (params: UpdateScriptingNotebookParams) => Promise<ScriptingNotebook>;
    deleteNotebook: (params: DeleteScriptingNotebookParams) => Promise<void>;
    createSession: (params: CreateScriptingSessionParams) => Promise<ScriptingSession>;
    createNotebookSession: (params: CreateScriptingNotebookSessionParams) => Promise<ScriptingSession>;
};

const baseService = defineServiceModule({
    clients: client,
    endpoints
});

const service: ScriptingService = {
    listNotebooks: baseService.listNotebooks,
    createNotebook: baseService.createNotebook,
    updateNotebook: baseService.updateNotebook,
    deleteNotebook: baseService.deleteNotebook,
    createSession: baseService.createSession,
    createNotebookSession: baseService.createNotebookSession
};

export default service;
