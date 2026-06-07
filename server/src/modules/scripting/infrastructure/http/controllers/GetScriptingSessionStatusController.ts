import { GetScriptingSessionStatusUseCase } from '@modules/scripting/application/use-cases/GetScriptingSessionStatusUseCase';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { setJupyterProxyAccessCookie } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';
import { container } from 'tsyringe';
import type { GetScriptingSessionStatusOutputDTO } from '@modules/scripting/application/dtos/ScriptingSessionDTO';

const scriptingJupyterAccessTokenService = container.resolve(ScriptingJupyterAccessTokenService);

export default createController(GetScriptingSessionStatusUseCase, {
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    }),
    handleSuccess: (req: AuthenticatedRequest, res: Response, value: GetScriptingSessionStatusOutputDTO): void => {
        const { runtimeNotebookId, accessToken, ...response } = value;

        if (runtimeNotebookId && accessToken) {
            const teamId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
            if (teamId) {
                setJupyterProxyAccessCookie(
                    req,
                    res,
                    accessToken,
                    teamId,
                    runtimeNotebookId,
                    scriptingJupyterAccessTokenService.getCookieMaxAgeMs()
                );
            }
        }

        BaseResponse.success(res, response);
    }
});
