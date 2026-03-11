import { post } from '@/app/core/http/utilities/create-service';
import type { CreateScriptingNotebookSessionParams, CreateScriptingSessionParams } from '../../dtos/create-scripting-session';
import type { ScriptingSession } from '../../entities/scripting-session';

const endpoints = {
    createSession: post<CreateScriptingSessionParams, ScriptingSession>('/:trajectoryId/sessions', {
        body: ({ notebookId, teamClusterId }) => ({ notebookId, teamClusterId })
    }),
    createNotebookSession: post<CreateScriptingNotebookSessionParams, ScriptingSession>('/sessions', {
        body: ({ notebookId, teamClusterId }) => ({ notebookId, teamClusterId })
    })
};

export default endpoints;
