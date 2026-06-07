import { DeleteScriptingSessionUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingSessionUseCase';
import { clearJupyterProxyAccessCookie } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';
import type { DeleteScriptingSessionOutputDTO } from '@modules/scripting/application/dtos/ScriptingSessionDTO';

export default createController(DeleteScriptingSessionUseCase, {
    handleSuccess: (req: AuthenticatedRequest, res: Response, value: DeleteScriptingSessionOutputDTO): void => {
        const { runtimeNotebookId, ...response } = value;
        const teamId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;

        if (runtimeNotebookId && teamId) {
            clearJupyterProxyAccessCookie(req, res, teamId, runtimeNotebookId);
        }

        BaseResponse.success(res, response);
    }
});
