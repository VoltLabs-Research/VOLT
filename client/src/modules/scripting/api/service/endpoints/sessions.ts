import { del, get, post } from '@/app/core/http/utilities/create-service';
import type { CreateScriptingNotebookSessionParams, CreateScriptingSessionParams } from '../../dtos/create-scripting-session';
import type { ScriptingSession } from '../../entities/scripting-session';

export interface ReadNotebookSessionStatusParams {
    notebookId: string;
};

export interface DeleteNotebookSessionParams {
    notebookId: string;
};

const endpoints = {
    createSession: post<CreateScriptingSessionParams, ScriptingSession>('/:trajectoryId/sessions', {
        body: ({ notebookId, teamClusterId }) => ({ notebookId, teamClusterId })
    }),
    createNotebookSession: post<CreateScriptingNotebookSessionParams, ScriptingSession>('/sessions', {
        body: ({ notebookId, teamClusterId }) => ({ notebookId, teamClusterId })
    }),
    readNotebookSessionStatus: get<ReadNotebookSessionStatusParams, ScriptingSession>('/sessions/:notebookId/status'),
    deleteNotebookSession: del<DeleteNotebookSessionParams>('/sessions/:notebookId')
};

export default endpoints;
