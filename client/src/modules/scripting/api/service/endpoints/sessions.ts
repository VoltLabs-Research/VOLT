import { post } from '@/app/core/http/utilities/create-service';
import type { CreateScriptingSessionParams } from '../../dtos/create-scripting-session';
import type { ScriptingSession } from '../../entities/scripting-session';

const endpoints = {
    createSession: post<CreateScriptingSessionParams, ScriptingSession>('/:trajectoryId/jupyter-session')
};

export default endpoints;
